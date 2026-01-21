import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: process.env.PORT || 3000 });
const peers = new Map();

wss.on("connection", ws => {
  let myId = null;

  ws.on("message", raw => {
    let data;
    try { data = JSON.parse(raw); } catch { return; }

    // Register
    if (data.type === "register") {
      myId = data.id;
      peers.set(myId, ws);
      ws.send(JSON.stringify({ type: "registered", id: myId }));
      return;
    }

    // Online check (reply only to requester)
    if (data.type === "isOnline") {
      ws.send(JSON.stringify({
        type: "isOnline",
        peer: data.peer,
        online: peers.has(data.peer)
      }));
      return;
    }

    // Forward request / accept / offer / answer / candidate
    if (data.to && peers.has(data.to)) {
      peers.get(data.to).send(JSON.stringify({
        ...data,
        from: myId
      }));
    }
  });

  ws.on("close", () => {
    if (myId) peers.delete(myId);
  });
});

console.log("Signaling server ready");
