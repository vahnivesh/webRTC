import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 3000;
const wss = new WebSocketServer({ port: PORT });

const peers = new Map(); // RAM ONLY

wss.on("connection", ws => {
  let id = null;

  ws.on("message", raw => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    // Join with a temporary ID
    if (data.join) {
      id = data.join;
      peers.set(id, ws);

      // Auto-expire after 5 minutes
      setTimeout(() => {
        if (peers.get(id) === ws) peers.delete(id);
      }, 5 * 60 * 1000);

      return;
    }

    // Relay signaling data
    if (data.to && peers.has(data.to)) {
      peers.get(data.to).send(JSON.stringify(data));
    }
  });

  ws.on("close", () => {
    if (id) peers.delete(id);
  });
});

console.log("WebRTC signaling server running");
