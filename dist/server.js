"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const url_1 = require("url");
const next_1 = __importDefault(require("next"));
const ws_1 = require("ws");
const realtime_api_beta_1 = require("@openai/realtime-api-beta");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;
const app = (0, next_1.default)({ dev, hostname, port });
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
    const client = new realtime_api_beta_1.RealtimeClient({ apiKey: OPENAI_API_KEY });
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
        }
        catch (e) {
            console.error(e.message);
            log(`Error parsing event from client: ${data}`);
        }
    };
    ws.on("message", (data) => {
        if (!client.isConnected()) {
            messageQueue.push(data);
        }
        else {
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
    }
    catch (e) {
        log(`Error connecting to OpenAI: ${e.message}`);
        ws.close();
        return;
    }
};
app.prepare().then(() => {
    const server = (0, http_1.createServer)(async (req, res) => {
        try {
            const parsedUrl = (0, url_1.parse)(req.url, true);
            const { pathname, query } = parsedUrl;
            if (pathname === '/api/ws') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'available',
                    connectedClients,
                    port
                }));
            }
            else {
                await handle(req, res, parsedUrl);
            }
        }
        catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    });
    const wss = new ws_1.WebSocketServer({ server });
    wss.on('connection', handleWebSocketConnection);
    server.listen(port, (err) => {
        if (err)
            throw err;
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});
