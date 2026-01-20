import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: process.env.PORT || 3000 });
const peers = new Map();

wss.on("connection", ws => {
  let id = null;

  ws.on("message", raw => {
    let data;
    try { data = JSON.parse(raw); } catch { return; }

    // Register browser ID
    if (data.type === "register") {
      id = data.id;
      peers.set(id, ws);
      ws.send(JSON.stringify({ type: "registered", id }));
      return;
    }

    // Check online
    if (data.type === "isOnline") {
      ws.send(JSON.stringify({
        type: "isOnline",
        peer: data.peer,
        online: peers.has(data.peer)
      }));
      return;
    }

    // Forward messages
    if (data.to && peers.has(data.to)) {
      peers.get(data.to).send(JSON.stringify({ ...data, from: id }));
    }
  });

  ws.on("close", () => {
    if (id) peers.delete(id);
  });
});

console.log("Signaling server ready");
