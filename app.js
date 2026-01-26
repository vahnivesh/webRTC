import { WebSocketServer } from "ws";
import crypto from "crypto";
const wss = new WebSocketServer({ port: process.env.PORT || 3000 });
// existing
const peers = new Map(); // peerId -> ws
// added (invisible isolation)
const sessions = new Map();      // sessionId -> Set(peerIds)
const peerSession = new Map();   // peerId -> sessionId
function createSession(a, b) {
  // if already in same session, do nothing
  const sa = peerSession.get(a);
  const sb = peerSession.get(b);
  if (sa && sa === sb) return;
  // clean previous sessions (1v1 strict)
  if (sa) destroySession(sa);
  if (sb) destroySession(sb);
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, new Set([a, b]));
  peerSession.set(a, sessionId);
  peerSession.set(b, sessionId);
}
function destroySession(sessionId) {
  const members = sessions.get(sessionId);
  if (!members) return;
  for (const p of members) {
    peerSession.delete(p);
  }
  sessions.delete(sessionId);
}
wss.on("connection", ws => {
  let myId = null;
  ws.on("message", raw => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    // =====================
    // Ping/Pong (ADDED)
    // =====================
    if (data.type === "ping") {
      ws.send(JSON.stringify({ type: "pong" }));
      return;
    }
    // =====================
    // Register (UNCHANGED)
    // =====================
    if (data.type === "register") {
      myId = data.id;
      peers.set(myId, ws);
      ws.send(JSON.stringify({ type: "registered", id: myId }));
      return;
    }
    // =====================
    // Online check (UNCHANGED)
    // =====================
    if (data.type === "isOnline") {
      ws.send(JSON.stringify({
        type: "isOnline",
        peer: data.peer,
        online: peers.has(data.peer)
      }));
      return;
    }
    // =====================
    // Call initiation (ADDED isolation)
    // =====================
    if ((data.type === "request" || data.type === "call") && data.to && peers.has(data.to)) {
      createSession(myId, data.to);
      peers.get(data.to).send(JSON.stringify({
        ...data,
        from: myId
      }));
      return;
    }
    // =====================
    // Forward signaling (ISOLATED)
    // =====================
    const sessionId = peerSession.get(myId);
    if (!sessionId) return;
    const members = sessions.get(sessionId);
    if (!members) return;
    for (const peerId of members) {
      if (peerId !== myId && peers.has(peerId)) {
        peers.get(peerId).send(JSON.stringify({
          ...data,
          from: myId
        }));
      }
    }
  });
  ws.on("close", () => {
    if (myId) {
      const sessionId = peerSession.get(myId);
      if (sessionId) destroySession(sessionId);
      peers.delete(myId);
    }
  });
});
console.log("Signaling server ready (isolated 1v1 sessions)");
