const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;
const PING_INTERVAL = 30_000;
const PEER_TIMEOUT = 60_000;

const peers = new Map();

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer((req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    const peerList = Array.from(peers.entries()).map(([id, p]) =>
      `<tr><td>${id.slice(0, 12)}...</td><td>${new Date(p.lastSeen).toLocaleTimeString()}</td></tr>`
    ).join('');
    res.end(`<html><head><meta charset="utf-8"><title>SofiLink Relay</title><style>body{font-family:sans-serif;background:#0D1117;color:#E6EDF3;padding:24px;max-width:600px;margin:auto}h1{color:#58A6FF}.stat{color:#8B949E;font-size:14px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #30363D}th{color:#8B949E;font-size:12px;text-transform:uppercase}.green{color:#3FB950}.grey{color:#484F58}</style></head><body>
<h1>SofiLink Relay</h1>
<p class="stat">Status: <span class="green">● Online</span></p>
<p class="stat">Peers connected: <strong>${peers.size}</strong></p>
<p class="stat">WebSocket endpoint: <code>ws://host:${PORT}</code></p>
${peers.size > 0 ? `<table><tr><th>Peer ID</th><th>Last Seen</th></tr>${peerList}</table>` : '<p class="grey">No peers connected</p>'}
</body></html>`);
    return;
  }
  if (req.url === '/health') {
    const now = Date.now();
    const online = Array.from(peers.entries()).map(([id, p]) => ({
      id,
      lastSeen: p.lastSeen,
      age: now - p.lastSeen,
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, peers: peers.size, online, uptime: process.uptime() }));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  let peerId = null;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);

      switch (msg.type) {
        case 'relay_register':
          peerId = msg.peerId;
          peers.set(peerId, { ws, lastSeen: Date.now() });
          broadcastExcept(peerId, { type: 'relay_peer_online', peerId, timestamp: Date.now() });
          ws.send(JSON.stringify({ type: 'relay_peer_list', peers: Array.from(peers.keys()), timestamp: Date.now() }));
          console.log(`[+] Peer registered: ${peerId.slice(0, 12)}... (total: ${peers.size})`);
          break;

        case 'relay_send':
          if (!peerId) break;
          const target = peers.get(msg.targetPeerId);
          if (target && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(JSON.stringify({ type: 'relay_message', senderId: peerId, payload: msg.payload, timestamp: Date.now() }));
          } else {
            ws.send(JSON.stringify({ type: 'relay_error', message: `Peer ${msg.targetPeerId} is offline` }));
          }
          break;

        case 'relay_broadcast':
          if (!peerId) break;
          broadcastExcept(peerId, { type: 'relay_message', senderId: peerId, payload: msg.payload, timestamp: Date.now() });
          break;

        case 'relay_ping':
          if (peerId) peers.set(peerId, { ws, lastSeen: Date.now() });
          break;
      }
    } catch (err) {
      console.warn('Invalid message:', err.message);
    }
  });

  ws.on('close', () => {
    if (peerId) {
      peers.delete(peerId);
      broadcastExcept(peerId, { type: 'relay_peer_offline', peerId, timestamp: Date.now() });
      console.log(`[-] Peer disconnected: ${peerId.slice(0, 12)}... (total: ${peers.size})`);
    }
  });

  ws.on('error', () => { if (peerId) peers.delete(peerId); });
});

function broadcastExcept(senderId, msg) {
  const data = JSON.stringify(msg);
  for (const [id, peer] of peers) {
    if (id !== senderId && peer.ws.readyState === WebSocket.OPEN) peer.ws.send(data);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [id, peer] of peers) {
    if (now - peer.lastSeen > PEER_TIMEOUT) {
      console.log(`[-] Peer timeout: ${id.slice(0, 12)}...`);
      peer.ws.close();
      peers.delete(id);
    }
  }
}, PING_INTERVAL);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[SofiLink Relay] running on port ${PORT}`);
});
