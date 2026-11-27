// Auto-join networking + voice chat (PeerJS, free public server).
// Everyone tries to claim the same room name. The first one gets it and becomes the host.
// Anyone after that joins the host. The host relays game messages to everyone.
// Made tough: heartbeats find dead links, timeouts retry, a lost host gets replaced,
// and the signalling server reconnects by itself.
export const ROOM = 'hollow-creek-abandoned-city-v2';

export function createNet(h) {
  // h = { onStatus(text, level), onMessage(msg, fromId), onVoice(id, stream), onGone(id), onLink(isHost, count) }
  const net = {
    peer: null, myId: '', isHost: false, conns: new Map(), lastRx: new Map(),
    mic: null, calls: new Map(), peerMic: new Set(), known: new Set(),
    retry: null, fails: 0, joinTimer: null, started: false,
  };
  const status = (t, lvl = 'info') => h.onStatus(t, lvl);
  const link = () => h.onLink && h.onLink(net.isHost, net.conns.size);

  function reset(ms) {
    clearTimeout(net.retry); clearTimeout(net.joinTimer);
    const old = net.peer;
    net.peer = null;            // first, so close handlers don't loop
    for (const id of net.conns.keys()) h.onGone(id);
    net.conns.clear(); net.lastRx.clear(); net.calls.clear(); net.peerMic.clear(); net.known.clear();
    net.myId = ''; net.isHost = false;
    try { old && old.destroy(); } catch (e) {}
    link();
    net.retry = setTimeout(start, ms ?? 0);
  }
  const backoff = () => Math.min(15000, 1500 * Math.pow(1.6, net.fails++));

  function start() {
    net.started = true;
    if (!window.Peer) { status('📴 No internet for multiplayer. Playing solo.', 'bad'); return; }
    status('🔎 Looking for your friend…');
    const p = new window.Peer(ROOM, { debug: 0 });
    net.peer = p;
    p.on('open', (id) => {
      if (net.peer !== p) return;
      net.fails = 0; net.myId = id; net.isHost = true; wire(p);
      status('🏠 You opened the city. Waiting for your friend…');
      link();
    });
    p.on('error', (e) => {
      if (net.peer !== p) return;
      if (e.type === 'unavailable-id') joinAsGuest();          // someone already hosts the room
      else if (e.type === 'peer-unavailable') {}               // a voice call to someone who left
      else { status('⚠️ Network hiccup (' + e.type + '), retrying…', 'bad'); reset(backoff()); }
    });
    p.on('disconnected', () => { if (net.peer === p && !p.destroyed) setTimeout(() => { try { if (net.peer === p && !p.destroyed) p.reconnect(); } catch (e) {} }, 1000); });
  }

  function joinAsGuest() {
    try { net.peer && net.peer.destroy(); } catch (e) {}
    const p = new window.Peer({ debug: 0 });
    net.peer = p;
    p.on('open', (id) => {
      if (net.peer !== p) return;
      net.myId = id; net.isHost = false; wire(p);
      status('🤝 Found your friend! Joining…');
      const c = p.connect(ROOM, { reliable: true, serialization: 'json' });
      addConn(c);
      // if the join doesn't finish in 8 s, start over
      net.joinTimer = setTimeout(() => { if (net.peer === p && !(c.open)) { status('⏳ Join is slow, trying again…', 'bad'); reset(500 + Math.random() * 1000); } }, 8000);
    });
    p.on('error', (e) => {
      if (net.peer !== p) return;
      if (e.type === 'peer-unavailable') {
        if (net.conns.has(ROOM) && net.conns.get(ROOM).open) return;   // just a voice call failing
        reset(300 + Math.random() * 900);   // the host left before we got in: race to be the new host
      } else { status('⚠️ Network hiccup (' + e.type + '), retrying…', 'bad'); reset(backoff()); }
    });
    p.on('disconnected', () => { if (net.peer === p && !p.destroyed) setTimeout(() => { try { if (net.peer === p && !p.destroyed) p.reconnect(); } catch (e) {} }, 1000); });
  }

  function wire(p) {
    p.on('connection', (c) => addConn(c));
    p.on('call', (call) => {
      // a new call replaces any older one with the same player
      const old = net.calls.get(call.peer);
      if (old && old !== call) { try { old.close(); } catch (e) {} }
      call.answer(net.mic || undefined);
      attachCall(call, !!net.mic);
    });
  }

  function addConn(c) {
    const prev = net.conns.get(c.peer);
    if (prev && prev !== c) { try { prev.close(); } catch (e) {} }
    net.conns.set(c.peer, c);
    net.lastRx.set(c.peer, performance.now());
    const opened = () => {
      clearTimeout(net.joinTimer);
      net.fails = 0;
      net.lastRx.set(c.peer, performance.now());
      status(net.isHost ? '🟢 Your friend joined!' : '🟢 Connected to your friend!', 'good');
      if (net.mic) c.send({ t: 'mic', id: net.myId });
      if (net.isHost) c.send({ t: 'peers', ids: [...net.conns.keys()] });
      link();
      ensureCall(c.peer);
    };
    c.on('open', opened);
    c.on('data', (msg) => {
      net.lastRx.set(c.peer, performance.now());
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'hb') return;
      if (msg.t === 'mic') { gotMic(msg.id || c.peer); if (net.isHost) send(msg, c.peer); return; }
      if (msg.t === 'peers') { for (const id of msg.ids) if (id !== net.myId) net.known.add(id); return; }
      if (msg.id && msg.id !== net.myId) net.known.add(msg.id);
      h.onMessage(msg, c.peer);
    });
    c.on('close', () => dropConn(c));
    c.on('error', () => dropConn(c));
    if (c.open) opened();
  }
  function dropConn(c) {
    if (net.conns.get(c.peer) !== c) return;
    net.conns.delete(c.peer);
    net.lastRx.delete(c.peer);
    const call = net.calls.get(c.peer);
    if (call) { try { call.close(); } catch (e) {} net.calls.delete(c.peer); }
    h.onGone(c.peer);
    link();
    if (!net.isHost && c.peer === ROOM && net.peer) {
      status('🌀 Your friend (the host) left. Taking over the city…', 'bad');
      reset(400 + Math.random() * 800);
    } else if (net.isHost) {
      status(net.conns.size ? '🟢 Friends connected: ' + net.conns.size : '🏠 Waiting for your friend…', net.conns.size ? 'good' : 'info');
    }
  }

  // heartbeats: a link that goes quiet for 7 s is dead
  setInterval(() => {
    const now = performance.now();
    for (const [id, c] of net.conns) {
      if (c.open) { try { c.send({ t: 'hb' }); } catch (e) {} }
      if (now - (net.lastRx.get(id) || now) > 7000) { try { c.close(); } catch (e) {} dropConn(c); }
    }
  }, 1000);

  // Send to everyone (host) or to the host (guest). `except` skips one player (for relaying).
  function send(msg, except) {
    for (const [id, c] of net.conns) if (c.open && id !== except) { try { c.send(msg); } catch (e) {} }
  }

  // ---------- voice ----------
  // Rule: if both have a mic, the lower id calls. If only one has a mic, that one calls.
  function ensureCall(id) {
    if (!net.mic || !net.peer || !net.myId || id === net.myId) return;
    const cur = net.calls.get(id);
    if (cur && cur._hasMyMic && cur.open !== false) return;
    if (net.peerMic.has(id) && net.myId > id) return;   // they will call me
    if (cur) { try { cur.close(); } catch (e) {} }
    try { attachCall(net.peer.call(id, net.mic), true); } catch (e) {}
  }
  function gotMic(id) {
    if (id === net.myId) return;
    net.peerMic.add(id);
    net.known.add(id);
    // if our call to them was one-way (they had no mic), redo it so we hear them too
    const cur = net.calls.get(id);
    if (net.mic && (net.myId < id || !cur)) {
      if (cur) { try { cur.close(); } catch (e) {} net.calls.delete(id); }
      ensureCall(id);
    }
  }
  function attachCall(call, hasMyMic) {
    call._hasMyMic = hasMyMic;
    net.calls.set(call.peer, call);
    call.on('stream', (s) => h.onVoice(call.peer, s));
    call.on('close', () => { if (net.calls.get(call.peer) === call) net.calls.delete(call.peer); });
    call.on('error', () => { if (net.calls.get(call.peer) === call) net.calls.delete(call.peer); });
  }
  function setMic(stream) {
    net.mic = stream;
    send({ t: 'mic', id: net.myId });
    for (const id of new Set([...net.conns.keys(), ...net.known])) ensureCall(id);
  }
  // every few seconds, fix any voice links that went missing
  setInterval(() => { if (net.mic) for (const id of new Set([...net.conns.keys(), ...net.known])) ensureCall(id); }, 4000);

  net.start = start;
  net.send = send;
  net.setMic = setMic;
  net.forget = (id) => { net.known.delete(id); net.peerMic.delete(id); };
  return net;
}
