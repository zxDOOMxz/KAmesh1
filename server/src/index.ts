import http from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from './config';
import { pool } from './db/pool';
import authRoutes from './routes/auth';
import chatRoutes from './routes/chats';
import messageRoutes from './routes/messages';
import conferenceRoutes from './routes/conferences';
import adminRoutes from './routes/admin';

const app = express();

// Manual CORS headers — гарантированно на каждый ответ
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/chats', messageRoutes);
app.use('/api/conferences', conferenceRoutes);
app.use('/api/admin', adminRoutes);

// ---- WebSocket relay (legacy + new) ----
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

interface PeerState {
  ws: WebSocket;
  lastSeen: number;
}

const peers = new Map<string, PeerState>();
const PEER_TIMEOUT = 60_000;
const PING_INTERVAL = 30_000;

wss.on('connection', (ws) => {
  let peerId: string | null = null;
  let userId: number | null = null;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      switch (msg.type) {
        // Legacy relay protocol
        case 'relay_register':
          peerId = msg.peerId as string;
          if (!peerId) break;
          peers.set(peerId, { ws, lastSeen: Date.now() });
          broadcastExcept(peerId, { type: 'relay_peer_online', peerId, timestamp: Date.now() });
          ws.send(JSON.stringify({ type: 'relay_peer_list', peers: Array.from(peers.keys()), timestamp: Date.now() }));
          console.log(`[WS] Peer registered: ${peerId.slice(0, 12)}... (total: ${peers.size})`);
          break;

        case 'relay_send':
          if (!peerId) break;
          {
            const target = peers.get(msg.targetPeerId as string);
            if (target?.ws.readyState === WebSocket.OPEN) {
              target.ws.send(JSON.stringify({ type: 'relay_message', senderId: peerId, payload: msg.payload, timestamp: Date.now() }));
            } else {
              ws.send(JSON.stringify({ type: 'relay_error', message: `Peer ${msg.targetPeerId} is offline` }));
            }
          }
          break;

        case 'relay_broadcast':
          if (!peerId) break;
          broadcastExcept(peerId, { type: 'relay_message', senderId: peerId, payload: msg.payload, timestamp: Date.now() });
          break;

        case 'relay_ping':
          if (peerId) peers.set(peerId, { ws, lastSeen: Date.now() });
          break;

        // WebRTC signaling for video conferences
        case 'signal:offer':
        case 'signal:answer':
        case 'signal:ice-candidate':
          if (!peerId) break;
          {
            const target = peers.get(msg.targetPeerId as string);
            if (target?.ws.readyState === WebSocket.OPEN) {
              target.ws.send(JSON.stringify(msg));
            }
          }
          break;

        case 'signal:join':
          peerId = msg.peerId as string;
          userId = msg.userId as number;
          if (!peerId) break;
          peers.set(peerId, { ws, lastSeen: Date.now() });
          broadcastExcept(peerId, { type: 'signal:user-joined', peerId, userId, conferenceId: msg.conferenceId });
          ws.send(JSON.stringify({
            type: 'signal:room-peers',
            peers: Array.from(peers.entries())
              .filter(([id]) => id !== peerId)
              .map(([id]) => ({ peerId: id })),
          }));
          break;

        case 'signal:leave':
          if (peerId) {
            broadcastExcept(peerId, { type: 'signal:user-left', peerId, userId });
          }
          break;
      }
    } catch (err) {
      console.warn('[WS] Invalid message:', (err as Error).message);
    }
  });

  ws.on('close', () => {
    if (peerId) {
      peers.delete(peerId);
      broadcastExcept(peerId, { type: 'relay_peer_offline', peerId, timestamp: Date.now() });
      broadcastExcept(peerId, { type: 'signal:user-left', peerId, userId });
      console.log(`[WS] Peer disconnected: ${peerId.slice(0, 12)}... (total: ${peers.size})`);
    }
  });

  ws.on('error', () => { if (peerId) peers.delete(peerId); });
});

function broadcastExcept(senderId: string, msg: object) {
  const data = JSON.stringify(msg);
  for (const [id, peer] of peers) {
    if (id !== senderId && peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(data);
    }
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [id, peer] of peers) {
    if (now - peer.lastSeen > PEER_TIMEOUT) {
      peer.ws.close();
      peers.delete(id);
      console.log(`[WS] Peer timeout: ${id.slice(0, 12)}...`);
    }
  }
}, PING_INTERVAL);

// Start server
server.listen(config.port, '0.0.0.0', async () => {
  try {
    await pool.query('SELECT 1');
    console.log('[DB] PostgreSQL connected');
  } catch (err) {
    console.error('[DB] Connection failed:', (err as Error).message);
  }
  console.log(`[Server] listening on port ${config.port}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] shutting down...');
  wss.close();
  await pool.end();
  server.close();
  process.exit(0);
});
