import Console from "./_components/Console";

export default function Home() {

  const relayServerUrl = process.env.WEBSITE_HOSTNAME ? `wss://${process.env.WEBSITE_HOSTNAME}/api/ws` : "ws://localhost:3000/api/ws"

  // here you can fetch data to pass to the console

  return <Console relayServerUrl={relayServerUrl} />
}
