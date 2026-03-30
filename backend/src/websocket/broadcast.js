const clients = new Set();

export function attachWebSocketServer(wss) {
  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });
}

export function broadcastJson(payload) {
  const s = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(s);
  }
}

export function makeBroadcaster() {
  return (type, data) => {
    broadcastJson({ type, ...data });
  };
}
