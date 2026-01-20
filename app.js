import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: process.env.PORT || 3000 });

// id -> ws
const peers = new Map();

// roomId -> Set(peerIds)
const rooms = new Map();

wss.on("connection", ws => {
  let myId = null;
  let myRoom = null;

  ws.on("message", raw => {
    let data;
    try { data = JSON.parse(raw); } catch { return; }

    /* ---------- REGISTER ---------- */
    if (data.type === "register") {
      myId = data.id;
      peers.set(myId, ws);
      ws.send(JSON.stringify({ type: "registered", id: myId }));
      return;
    }

    /* ---------- ONLINE CHECK (for private chat) ---------- */
    if (data.type === "isOnline") {
      ws.send(JSON.stringify({
        type: "isOnline",
        peer: data.peer,
        online: peers.has(data.peer)
      }));
      return;
    }

    /* ---------- CREATE ROOM ---------- */
    if (data.type === "create-room") {
      const roomId = crypto.randomUUID().slice(0, 6);
      rooms.set(roomId, new Set([myId]));
      myRoom = roomId;

      ws.send(JSON.stringify({
        type: "room-created",
        roomId,
        members: [myId]
      }));
      return;
    }

    /* ---------- JOIN ROOM ---------- */
    if (data.type === "join-room") {
      const room = rooms.get(data.roomId);
      if (!room || room.size >= 6) {
        ws.send(JSON.stringify({ type: "room-error" }));
        return;
      }

      room.add(myId);
      myRoom = data.roomId;

      // notify others in room
      for (const pid of room) {
        if (pid !== myId && peers.has(pid)) {
          peers.get(pid).send(JSON.stringify({
            type: "peer-joined",
            peerId: myId
          }));
        }
      }

      ws.send(JSON.stringify({
        type: "room-joined",
        roomId: myRoom,
        members: [...room]
      }));
      return;
    }

    /* ---------- RELAY (PRIVATE + WEBRTC SIGNALING) ---------- */
    if (data.to && peers.has(data.to)) {
      peers.get(data.to).send(JSON.stringify({
        ...data,
        from: myId
      }));
    }
  });

  ws.on("close", () => {
    peers.delete(myId);

    if (myRoom && rooms.has(myRoom)) {
      const room = rooms.get(myRoom);
      room.delete(myId);

      if (room.size === 0) {
        rooms.delete(myRoom);
      }
    }
  });
});

console.log("Signaling server with rooms + private chat ready");
