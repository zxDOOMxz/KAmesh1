const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const clients = new Map(); // ws -> { nickname, peerId, ip }
const nicknames = new Map(); // nickname -> peerId (for uniqueness check)

const wss = new WebSocket.Server({ port: PORT });

console.log(`SofiLink signaling server on port ${PORT}`);

function broadcast(type, data, exclude = null) {
  const msg = JSON.stringify({ type, data });
  for (const [ws] of clients) {
    if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

function send(ws, type, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
}

function sendUserList() {
  const users = [];
  for (const [, info] of clients) {
    users.push({ nickname: info.nickname, peerId: info.peerId });
  }
  broadcast('user_list', users);
}

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  let currentNickname = null;
  let currentPeerId = null;

  ws.on('message', (raw) => {
    try {
      const { type, data } = JSON.parse(raw.toString());

      switch (type) {
        case 'register': {
          const { nickname, peerId, deviceId } = data;
          const existingPeerId = nicknames.get(nickname);
          
          if (existingPeerId && existingPeerId !== peerId) {
            send(ws, 'register_error', { error: 'nickname_taken', message: 'This nickname is already registered by another user' });
            return;
          }

          if (currentNickname && currentNickname !== nickname) {
            nicknames.delete(currentNickname);
          }

          currentNickname = nickname;
          currentPeerId = peerId;
          clients.set(ws, { nickname, peerId, ip, deviceId });
          nicknames.set(nickname, peerId);
          
          console.log(`Registered: ${nickname} (${peerId.slice(0, 8)}...) device=${(deviceId||'').slice(0, 8)}`);
          send(ws, 'register_ok', { nickname, peerId });
          sendUserList();
          break;
        }

        case 'search': {
          const { query } = data;
          const q = query.toLowerCase();
          const results = [];
          const seen = new Set();
          for (const [w, info] of clients) {
            const key = info.nickname + info.peerId;
            if (!seen.has(key) && (
              info.nickname.toLowerCase().includes(q) ||
              info.peerId.toLowerCase().includes(q)
            )) {
              seen.add(key);
              results.push({ nickname: info.nickname, peerId: info.peerId });
            }
          }
          if (!results.length) {
            for (const [, info] of clients) {
              if (!seen.has(info.nickname + info.peerId)) {
                results.push({ nickname: info.nickname, peerId: info.peerId });
              }
            }
          }
          send(ws, 'search_results', { query, results: results.slice(0, 20) });
          break;
        }

        case 'update_nickname': {
          const { oldNickname, newNickname, peerId } = data;
          const existing = nicknames.get(newNickname);
          if (existing && existing !== peerId) {
            send(ws, 'nickname_error', { error: 'Этот никнейм уже занят' });
            return;
          }
          if (oldNickname) nicknames.delete(oldNickname);
          nicknames.set(newNickname, peerId);
          if (currentNickname === oldNickname) currentNickname = newNickname;
          const info = clients.get(ws);
          if (info) { info.nickname = newNickname; clients.set(ws, info); }
          send(ws, 'nickname_ok', { nickname: newNickname });
          sendUserList();
          break;
        }

        case 'ping': {
          send(ws, 'pong', {});
          break;
        }
      }
    } catch (e) {
      console.error('Message error:', e.message);
    }
  });

  ws.on('close', () => {
    if (currentNickname) {
      const info = clients.get(ws);
      if (info && info.peerId === currentPeerId) {
        nicknames.delete(currentNickname);
      }
      console.log(`Disconnected: ${currentNickname}`);
    }
    clients.delete(ws);
    sendUserList();
  });

  ws.on('error', () => {
    clients.delete(ws);
    if (currentNickname) nicknames.delete(currentNickname);
    sendUserList();
  });
});

wss.on('error', (e) => console.error('Server error:', e));
