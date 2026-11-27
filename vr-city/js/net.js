// Auto-join networking (PeerJS). Everyone tries to claim the same room name.
// The first one gets it and becomes the host. Anyone after finds the host and joins.
// The host relays messages, so everyone sees everyone (fine for a few players).
export const ROOM = 'abandoned-city-room-v1';

export function createNet(h) {
  // h = { onStatus(text), onMessage(msg, fromId), onVoice(id, stream), onGone(id) }
  const net = { peer: null, myId: '', isHost: false, conns: new Map(), mic: null, calls: new Map(), retry: null };

  function reset(ms) {
    clearTimeout(net.retry);
    const old = net.peer;
    net.peer = null;            // set first, so the close handlers don't loop
    net.conns.clear(); net.calls.clear();
    net.myId = ''; net.isHost = false;
    try { old && old.destroy(); } catch (e) {}
    net.retry = setTimeout(start, ms || 0);
  }

  function start() {
    if (!window.Peer) { h.onStatus('📴 No network. Refresh to try again.'); return; }
    h.onStatus('🔎 Looking for your friend…');
    const p = new window.Peer(ROOM);
    net.peer = p;
    p.on('open', (id) => {
      net.myId = id; net.isHost = true; wire(p);
      h.onStatus('🏠 You are in the city. Waiting for your friend…');
    });
    p.on('error', (e) => {
      if (e.type === 'unavailable-id') joinAsGuest();          // someone already hosts the room
      else { h.onStatus('⚠️ ' + e.type + ', retrying…'); reset(3000); }
    });
  }

  function joinAsGuest() {
    try { net.peer && net.peer.destroy(); } catch (e) {}
    const p = new window.Peer();
    net.peer = p;
    p.on('open', (id) => {
      net.myId = id; net.isHost = false; wire(p);
      addConn(p.connect(ROOM, { serialization: 'json' }));
      h.onStatus('🤝 Joining your friend…');
    });
    p.on('error', (e) => {
      if (e.type === 'peer-unavailable') reset(300);             // no host yet: become the host
      else { h.onStatus('⚠️ ' + e.type + ', retrying…'); reset(3000); }
    });
  }

  function wire(p) {
    p.on('connection', (c) => addConn(c));
    p.on('call', (call) => { call.answer(net.mic || undefined); attachCall(call); });
  }

  function addConn(c) {
    if (net.conns.has(c.peer)) return;
    net.conns.set(c.peer, c);
    const opened = () => { h.onStatus(net.isHost ? '🏠 Your friend is here!' : '🤝 Connected to the host!'); maybeCall(c.peer); };
    c.on('open', opened);
    c.on('data', (msg) => h.onMessage(msg, c.peer));
    c.on('close', () => {
      net.conns.delete(c.peer);
      h.onGone(c.peer);
      if (!net.isHost && c.peer === ROOM && net.peer) {
        h.onStatus('🌀 Host left. Finding a new host…');
        reset(1500);
      }
    });
    c.on('error', () => {});
    if (c.open) opened();
  }

  // Send to everyone (host) or to the host (guest). `except` skips one player (for relaying).
  function send(msg, except) {
    for (const [id, c] of net.conns) if (c.open && id !== except) c.send(msg);
  }

  // Voice: the player with the lower id calls, the other answers.
  function maybeCall(id) {
    if (!net.mic || !net.peer || net.calls.has(id) || net.myId > id) return;
    attachCall(net.peer.call(id, net.mic));
  }
  function attachCall(call) {
    net.calls.set(call.peer, call);
    call.on('stream', (s) => h.onVoice(call.peer, s));
    call.on('close', () => net.calls.delete(call.peer));
    call.on('error', () => {});
  }
  function setMic(stream) {
    net.mic = stream;
    for (const id of net.conns.keys()) maybeCall(id);
  }

  net.start = start;
  net.send = send;
  net.setMic = setMic;
  return net;
}
