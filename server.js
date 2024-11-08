import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { RealtimeClient } from '@openai/realtime-api-beta';
import dotenv from 'dotenv';

dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
console.log("NODE_ENV", process.env.NODE_ENV);
const hostname = process.env.WEBSITE_HOSTNAME ?? "localhost";
const port = 3000
const protocol = dev ? 'http' : 'https';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    console.error('Environment variable "OPENAI_API_KEY" is missing.');
    process.exit(1);
}

let connectedClients = 0;

const log = (...args) => console.log("[RealtimeRelay]", ...args);

const handleWebSocketConnection = async (ws) => {
    connectedClients++;
    log(`New WebSocket connection established. Total clients: ${connectedClients}`);

    const client = new RealtimeClient({ apiKey: OPENAI_API_KEY });

    client.realtime.on("server.*", (event) => {
        log(`Relaying "${event.type}" to Client: ${Object.keys(event).pop()}`);
        ws.send(JSON.stringify(event));
    });

    client.realtime.on("close", () => ws.close());

    const messageQueue = [];
    const messageHandler = async (data) => {
        try {
            const event = JSON.parse(data);
            log(`Relaying "${event.type}" to OpenAI`);
            await client.realtime.send(event.type, event);
        } catch (e) {
            console.error(e.message);
            log(`Error parsing event from client: ${data}`);
        }
    };

    ws.on("message", (data) => {
        if (!client.isConnected()) {
            messageQueue.push(data);
        } else {
            messageHandler(data);
        }
    });

    ws.on("close", () => {
        log("WebSocket connection closed");
        client.disconnect();
        connectedClients--;
    });

    try {
        log("Connecting to OpenAI...");
        await client.connect();
        log("Connected to OpenAI successfully!");
        while (messageQueue.length) {
            await messageHandler(messageQueue.shift());
        }
    } catch (e) {
        log(`Error connecting to OpenAI: ${e.message}`);
        ws.close();
        return;
    }
};

app.prepare().then(() => {
    const server = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true);
            const { pathname, query } = parsedUrl;

            if (pathname === '/api/ws') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'available',
                    connectedClients,
                    port
                }));
            } else {
                await handle(req, res, parsedUrl);
            }
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    });

    const wss = new WebSocketServer({ server });

    wss.on('connection', handleWebSocketConnection);

    server.listen(port, (err) => {
        if (err) throw err;
        console.log(`> Ready on ${protocol}://${hostname}:${port}`);
    });
});