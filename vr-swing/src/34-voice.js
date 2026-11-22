/* ======================================================================
   VOICE CHAT: talk to everyone in your room. Each pair of players gets a direct WebRTC audio call.
   You hear friends from where they stand (3D sound), never yourself. Mouths open with how loud you talk.
   No mic (or "Block")? Everything still works: you can still hear them, they just can't hear you.
   ====================================================================== */
const VC = { mic: null, micSrc: null, an: null, buf: null, level: 0, muted: store.get('kg-mute') === '1', asked: false, denied: false, calls: new Map(), silent: null };
function voicePeerId(id) { return id === 'host' ? MP_PREFIX + MP.code : id; }
async function micOn() {   // asked once when you make or join a room
  if (VC.mic || VC.asked) return VC.mic; VC.asked = true;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { VC.denied = true; return null; }
  try {
    VC.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    audioOn(); if (ac) { VC.micSrc = ac.createMediaStreamSource(VC.mic); VC.an = ac.createAnalyser(); VC.an.fftSize = 512; VC.buf = new Uint8Array(VC.an.fftSize); VC.micSrc.connect(VC.an); }   // measured only, never played back
    setMute(VC.muted); toast(VC.muted ? '🔇 Your mic is muted. Unmute it on the menu or the computer.' : online() ? '🎤 Mic on! Friends in your room can hear you.' : '🎤 Mic ready for voice chat!', 4);
    // calls that started before the mic was ready were sending silence: swap the real mic in
    const tr = VC.mic.getAudioTracks()[0];
    for (const v of VC.calls.values()) { try { const pc = v.call.peerConnection; if (pc) pc.getSenders().forEach(sn => { if (!sn.track || sn.track.kind === 'audio') sn.replaceTrack(tr); }); } catch (e) {} }
  } catch (e) {
    VC.denied = true;
    if (state.xr) { VC.asked = false; VC.retry = true; }   // the headset couldn't ask in VR: try again when you're back out (or press Enter VR again)
    else toast('🔇 No mic, no problem: you can still hear friends. (Allow the mic in your browser to talk.)', 5);
  }
  compDraw(); mpUi(); return VC.mic;
}
function setMute(m) {
  VC.muted = m; store.set('kg-mute', m ? '1' : '0');
  if (VC.mic) VC.mic.getAudioTracks().forEach(t => { t.enabled = !m; });
  const b = $('btnMute'); if (b) b.textContent = !VC.mic ? '🎤 Turn on mic' : m ? '🔇 Mic muted' : '🎤 Mic on';
  compDraw();
}
function outStream() {   // what we send: your mic, or silence if there's none (a call needs something to send)
  if (VC.mic) return VC.mic;
  if (!VC.silent && ac) { const d = ac.createMediaStreamDestination(); VC.silent = d.stream; }
  return VC.silent;
}
function hookCall(call, id) {
  const old = VC.calls.get(id); if (old && old.call !== call) { try { old.call.close(); } catch (e) {} dropVoiceNodes(old); }
  const v = { call, id, el: null, src: null, pan: null };
  VC.calls.set(id, v);
  call.on('stream', stream => {
    if (v.el) return; audioOn(); if (!ac) return;
    v.el = new Audio(); v.el.srcObject = stream; v.el.muted = true; v.el.play().catch(() => {});   // Chrome only feeds WebAudio while an element holds the stream
    v.src = ac.createMediaStreamSource(stream);
    v.pan = ac.createPanner(); v.pan.panningModel = 'HRTF'; v.pan.distanceModel = 'inverse'; v.pan.refDistance = 1.2; v.pan.rolloffFactor = .9; v.pan.maxDistance = 60;
    v.src.connect(v.pan); v.pan.connect(master);
  });
  call.on('close', () => { if (VC.calls.get(id) === v) { VC.calls.delete(id); dropVoiceNodes(v); } });
  call.on('error', () => {});
}
function dropVoiceNodes(v) { try { if (v.src) v.src.disconnect(); if (v.pan) v.pan.disconnect(); if (v.el) { v.el.srcObject = null; } } catch (e) {} v.src = v.pan = v.el = null; }
function voiceAnswer(call) {   // someone is calling us
  const id = call.peer === MP_PREFIX + MP.code ? 'host' : call.peer;
  try { call.answer(outStream()); hookCall(call, id); } catch (e) {}
}
function voiceMeet(id) {   // a new friend showed up: the player with the "smaller" id rings the other one, so each pair talks once
  if (!MP.peer || !MP.peer.call || VC.calls.has(id)) return;
  const them = voicePeerId(id), me = MP.peer.id;
  if (!(me < them)) return;
  const st = outStream(); if (!st) return;
  try { const call = MP.peer.call(them, st); if (call) hookCall(call, id); } catch (e) {}
}
function voiceBye(id) { const v = VC.calls.get(id); if (!v) return; VC.calls.delete(id); try { v.call.close(); } catch (e) {} dropVoiceNodes(v); }
function voiceStop() { for (const id of [...VC.calls.keys()]) voiceBye(id); }
function micLevel() {
  if (!VC.an || VC.muted) return 0;
  VC.an.getByteTimeDomainData(VC.buf); let s = 0; for (let i = 0; i < VC.buf.length; i += 2) { const x = (VC.buf[i] - 128) / 128; s += x * x; }
  return clamp((Math.sqrt(s / (VC.buf.length / 2)) - .015) * 9, 0, 1);
}
/* ---------- mouths ---------- */
const MOUTH_G = new THREE.SphereGeometry(.03, 14, 8), MOUTH_M = new THREE.MeshStandardMaterial({ color: 0x5a1626, roughness: .7 });
function addMouth(head, layer) {
  const m = new THREE.Mesh(MOUTH_G, MOUTH_M); m.position.set(0, -.142, -.185); m.scale.set(1.25, .12, .45); m.userData.keep = true; if (layer) m.layers.set(layer);
  head.add(m); head.userData.mouth = m; return m;
}
function setMouth(head, k) {
  const m = head && head.userData.mouth; if (!m) return;
  const talk = k > .04; m.visible = talk; m.scale.y = .12 + k * .95;
  if (head.userData.smile === undefined) head.userData.smile = head.getObjectByName('Smile') || null;
  if (head.userData.smile) head.userData.smile.visible = !talk;   // talking: the smile goes away, the open mouth takes over
  if (!head.userData.eyes) head.userData.eyes = ['EyeL', 'EyeR'].map(n => head.getObjectByName(n)).filter(Boolean);
  const e = 1 + Math.min(1, k * 1.3) * .85; head.userData.eyes.forEach(o => o.scale.setScalar(e));   // the louder you talk, the bigger your eyes
}
const _ls = V(), _lf = V(), _lu = V(), _lq = new THREE.Quaternion();
function stepVoice(dt) {
  const raw = online() ? micLevel() : 0;
  VC.level += (raw - VC.level) * Math.min(1, dt * (raw > VC.level ? 30 : 12));
  if (AV.head) { if (!AV.head.userData.mouth) addMouth(AV.head, SELF_LAYER); setMouth(AV.head, VC.level); }
  if (!online() || !ac || !VC.calls.size) return;
  // your ears are where your head is
  headWorld(_ls); camera.getWorldQuaternion(_lq); _lf.set(0, 0, -1).applyQuaternion(_lq); _lu.set(0, 1, 0).applyQuaternion(_lq);
  const L = ac.listener, t = ac.currentTime;
  if (L.positionX) { L.positionX.setTargetAtTime(_ls.x, t, .03); L.positionY.setTargetAtTime(_ls.y, t, .03); L.positionZ.setTargetAtTime(_ls.z, t, .03); L.forwardX.setTargetAtTime(_lf.x, t, .03); L.forwardY.setTargetAtTime(_lf.y, t, .03); L.forwardZ.setTargetAtTime(_lf.z, t, .03); L.upX.setTargetAtTime(_lu.x, t, .03); L.upY.setTargetAtTime(_lu.y, t, .03); L.upZ.setTargetAtTime(_lu.z, t, .03); }
  else { L.setPosition(_ls.x, _ls.y, _ls.z); L.setOrientation(_lf.x, _lf.y, _lf.z, _lu.x, _lu.y, _lu.z); }
  for (const [id, v] of VC.calls) {
    const f = MP.others.get(id); if (!v.pan || !f) continue; const p = f.head.position;
    if (v.pan.positionX) { v.pan.positionX.setTargetAtTime(p.x, t, .03); v.pan.positionY.setTargetAtTime(p.y, t, .03); v.pan.positionZ.setTargetAtTime(p.z, t, .03); } else v.pan.setPosition(p.x, p.y, p.z);
  }
}
{ const b = $('btnMute'); if (b) b.onclick = () => { if (!VC.mic) { VC.asked = false; micOn(); } else setMute(!VC.muted); }; setMute(VC.muted); }
