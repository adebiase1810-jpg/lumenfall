// ============ LUMENFALL — serveur de présence (optionnel) ============
// Fournit : connexion, sessions, présence en ligne réelle, relais d'invitations.
// Ne fournit PAS (encore) la synchronisation de gameplay — voir README, roadmap.
// Lancement : npm install && npm start   (port 8080 par défaut, PORT en variable d'env)
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });
const clients = new Map(); // ws -> {id, name}

function broadcastPresence() {
  const peers = [...clients.values()].map(({ id, name }) => ({ id, name }));
  const msg = JSON.stringify({ t: 'presence', peers });
  for (const ws of clients.keys()) if (ws.readyState === 1) ws.send(msg);
}

wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (typeof msg !== 'object' || !msg) return;

    if (msg.t === 'hello' && typeof msg.id === 'string' && typeof msg.name === 'string') {
      // éviter les doublons de session
      for (const [other, data] of clients) if (data.id === msg.id && other !== ws) { clients.delete(other); try { other.close(); } catch {} }
      clients.set(ws, { id: msg.id.slice(0, 32), name: msg.name.slice(0, 24) });
      broadcastPresence();
      console.log(`[+] ${msg.name} (${clients.size} en ligne)`);
    }
    if (msg.t === 'invite' && typeof msg.to === 'string') {
      const from = clients.get(ws);
      if (!from) return;
      for (const [other, data] of clients) {
        if (data.id === msg.to && other.readyState === 1) {
          other.send(JSON.stringify({ t: 'invite', from: from.name }));
        }
      }
    }
  });

  ws.on('close', () => {
    const data = clients.get(ws);
    clients.delete(ws);
    if (data) { broadcastPresence(); console.log(`[-] ${data.name} (${clients.size} en ligne)`); }
  });
  ws.on('error', () => { clients.delete(ws); });
});

// heartbeat
setInterval(() => {
  for (const ws of clients.keys()) {
    if (!ws.isAlive) { clients.delete(ws); try { ws.terminate(); } catch {} continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
  broadcastPresence();
}, 30000);

console.log(`LUMENFALL presence server — ws://0.0.0.0:${PORT}`);