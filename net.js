// ============ client réseau optionnel — présence réelle via WebSocket ============
// Honnêteté : ce module fournit la présence et le relais d'invitations.
// La synchronisation de partie n'est PAS implémentée côté client (voir README/roadmap).
import { S, notif } from '../core/store.js';
import { bus } from '../core/utils.js';

export function createNet() {
  let ws = null;
  let status = 'off'; // off | connecting | on | error
  let peers = [];
  let timeout = null;

  function setStatus(s) { status = s; bus.emit('net', { status, peers }); }

  function connect(url) {
    disconnect(true);
    const addr = url || S.settings.netUrl;
    if (!/^wss?:\/\//.test(addr)) { setStatus('error'); return; }
    setStatus('connecting');
    try { ws = new WebSocket(addr); } catch (e) { setStatus('error'); return; }
    timeout = setTimeout(() => { if (status === 'connecting') { disconnect(true); setStatus('error'); } }, 5000);
    ws.onopen = () => {
      clearTimeout(timeout);
      ws.send(JSON.stringify({ t: 'hello', id: S.profile.id, name: S.profile.name }));
      setStatus('on');
      notif('info', 'notif.netOn');
    };
    ws.onmessage = ev => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.t === 'presence') { peers = msg.peers.filter(p => p.id !== S.profile.id); bus.emit('net', { status, peers }); }
        if (msg.t === 'invite') { notif('social', 'notif.netInvite', { name: msg.from || '?' }); bus.emit('toast', { type: 'social', title: 'notif.title', msg: msg.from || '' }); }
      } catch (e) { /* message ignoré */ }
    };
    ws.onerror = () => { clearTimeout(timeout); if (status !== 'on') setStatus('error'); };
    ws.onclose = () => {
      clearTimeout(timeout);
      const was = status === 'on';
      ws = null; peers = [];
      setStatus(was ? 'off' : 'error');
      if (was) notif('info', 'notif.netOff');
    };
  }
  function disconnect(silent = false) {
    clearTimeout(timeout);
    if (ws) { try { ws.close(); } catch (e) {} ws = null; }
    peers = [];
    if (!silent) setStatus('off');
  }
  return {
    connect, disconnect,
    get status() { return status; },
    get peers() { return peers; },
  };
}