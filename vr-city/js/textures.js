// Hand-painted textures, drawn with code at load time (no image files to download).
// Every texture repeats, and city.js sets the UVs in metres, so 1 tile = `size` metres.
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function canvasTex(w, h, draw, seed = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  draw(x, w, h, rng(seed));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// dark smudges, drips and specks: makes everything look old and dirty
function grime(x, w, h, R, amount = 1) {
  for (let i = 0; i < 40 * amount; i++) {
    const gx = R() * w, gy = R() * h, r = 8 + R() * 50;
    const g = x.createRadialGradient(gx, gy, 0, gx, gy, r);
    g.addColorStop(0, `rgba(0,0,0,${0.12 + R() * 0.2})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(gx - r, gy - r, r * 2, r * 2);
  }
  for (let i = 0; i < 14 * amount; i++) {   // drips running down
    const gx = R() * w, gy = R() * h * 0.4, len = 30 + R() * 120;
    const g = x.createLinearGradient(0, gy, 0, gy + len);
    g.addColorStop(0, 'rgba(10,8,6,0.35)');
    g.addColorStop(1, 'rgba(10,8,6,0)');
    x.fillStyle = g;
    x.fillRect(gx, gy, 2 + R() * 4, len);
  }
  for (let i = 0; i < 900 * amount; i++) {
    x.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.05)';
    x.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2);
  }
}

function cracks(x, w, h, R, n, color = 'rgba(0,0,0,0.55)') {
  x.strokeStyle = color;
  for (let i = 0; i < n; i++) {
    let px = R() * w, py = R() * h;
    x.lineWidth = 1 + R() * 1.5;
    x.beginPath();
    x.moveTo(px, py);
    for (let k = 0; k < 8; k++) {
      px += (R() - 0.5) * 50; py += (R() - 0.5) * 50;
      x.lineTo(px, py);
    }
    x.stroke();
  }
}

export function makeTextures() {
  const T = {};

  T.brick = canvasTex(256, 256, (x, w, h, R) => {   // 2 m tile
    x.fillStyle = '#2a1712'; x.fillRect(0, 0, w, h);
    const bh = 16, bw = 36;
    for (let row = 0; row < h / bh; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let col = -1; col < w / bw + 1; col++) {
        const v = 60 + R() * 40, r = v + 25 + R() * 20;
        x.fillStyle = `rgb(${r | 0},${(v * 0.55) | 0},${(v * 0.45) | 0})`;
        x.fillRect(col * bw + off + 1, row * bh + 1, bw - 2, bh - 2);
      }
    }
    grime(x, w, h, R, 1.2);
  }, 11);

  T.concrete = canvasTex(256, 256, (x, w, h, R) => {   // 4 m tile, panels
    x.fillStyle = '#4a4c50'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2000; i++) {
      const v = 60 + R() * 30;
      x.fillStyle = `rgba(${v},${v},${v + 4},0.35)`;
      x.fillRect(R() * w, R() * h, 3, 3);
    }
    x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 2;
    x.strokeRect(0, 0, w, h);
    x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke();
    cracks(x, w, h, R, 5);
    grime(x, w, h, R, 1.4);
  }, 12);

  T.plaster = canvasTex(256, 256, (x, w, h, R) => {   // houses: peeling paint siding
    x.fillStyle = '#5b5446'; x.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, y + 13, w, 3);
      x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(0, y, w, 2);
    }
    for (let i = 0; i < 30; i++) {   // paint peeled off, wood showing
      x.fillStyle = `rgba(70,50,30,${0.4 + R() * 0.4})`;
      x.beginPath();
      x.ellipse(R() * w, R() * h, 4 + R() * 18, 2 + R() * 8, R() * 3, 0, 7);
      x.fill();
    }
    grime(x, w, h, R, 1.3);
  }, 13);

  T.metal = canvasTex(128, 128, (x, w, h, R) => {   // corrugated + rust
    for (let i = 0; i < w; i++) {
      const v = 55 + Math.sin(i / w * Math.PI * 16) * 18;
      x.fillStyle = `rgb(${v | 0},${(v * 1.02) | 0},${(v * 1.05) | 0})`;
      x.fillRect(i, 0, 1, h);
    }
    for (let i = 0; i < 25; i++) {
      x.fillStyle = `rgba(${110 + R() * 40},${45 + R() * 20},15,${0.3 + R() * 0.4})`;
      x.beginPath(); x.ellipse(R() * w, R() * h, 3 + R() * 14, 3 + R() * 22, 0, 0, 7); x.fill();
    }
    grime(x, w, h, R, 0.5);
  }, 14);

  T.wood = canvasTex(128, 128, (x, w, h, R) => {
    x.fillStyle = '#3d2a19'; x.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      x.fillStyle = `rgba(${R() < 0.5 ? 0 : 90},${R() < 0.5 ? 0 : 60},20,${0.08 + R() * 0.15})`;
      x.fillRect(0, y, w, 1 + R() * 2);
    }
    for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(0,0,0,0.6)'; x.beginPath(); x.arc(R() * w, R() * h, 1.5 + R() * 2, 0, 7); x.fill(); }   // nails
    grime(x, w, h, R, 0.5);
  }, 15);

  T.asphalt = canvasTex(512, 512, (x, w, h, R) => {   // 8 m tile
    x.fillStyle = '#17181b'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 12000; i++) {
      const v = 20 + R() * 35;
      x.fillStyle = `rgba(${v},${v},${v + 3},0.7)`;
      x.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2);
    }
    cracks(x, w, h, R, 14, 'rgba(0,0,0,0.8)');
    for (let i = 0; i < 6; i++) {   // puddles / oil
      const gx = R() * w, gy = R() * h, r = 20 + R() * 50;
      const g = x.createRadialGradient(gx, gy, 0, gx, gy, r);
      g.addColorStop(0, 'rgba(5,6,10,0.7)'); g.addColorStop(1, 'rgba(5,6,10,0)');
      x.fillStyle = g; x.fillRect(gx - r, gy - r, r * 2, r * 2);
    }
  }, 16);

  T.sidewalk = canvasTex(256, 256, (x, w, h, R) => {   // 4 m tile, 1 m slabs
    x.fillStyle = '#3a3b3d'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) {
      const v = 45 + R() * 30;
      x.fillStyle = `rgba(${v},${v},${v},0.4)`;
      x.fillRect(R() * w, R() * h, 2, 2);
    }
    x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h); x.stroke();
      x.beginPath(); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke();
    }
    cracks(x, w, h, R, 6);
    for (let i = 0; i < 20; i++) {   // weeds in cracks
      x.fillStyle = `rgba(30,${40 + R() * 25},20,0.8)`;
      x.fillRect(R() * w, R() * h, 3 + R() * 5, 2 + R() * 3);
    }
    grime(x, w, h, R, 0.6);
  }, 17);

  T.roof = canvasTex(128, 128, (x, w, h, R) => {   // shingles
    x.fillStyle = '#1c1a1c'; x.fillRect(0, 0, w, h);
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 9; col++) {
        if (R() < 0.06) continue;   // missing shingle
        const v = 22 + R() * 22;
        x.fillStyle = `rgb(${v},${v - 2},${v})`;
        x.fillRect(col * 16 + (row % 2) * 8, row * 8, 15, 7);
      }
    }
  }, 18);

  T.tar = canvasTex(128, 128, (x, w, h, R) => {   // flat roofs
    x.fillStyle = '#1b1c1e'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { const v = 25 + R() * 25; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(R() * w, R() * h, 1, 1); }
    grime(x, w, h, R, 0.4);
  }, 19);

  T.rust = canvasTex(128, 128, (x, w, h, R) => {   // car bodies, dumpsters, barrels
    x.fillStyle = '#4a2d1c'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      x.fillStyle = `rgba(${90 + R() * 70},${40 + R() * 30},${10 + R() * 15},${0.3 + R() * 0.5})`;
      x.beginPath(); x.ellipse(R() * w, R() * h, 2 + R() * 14, 2 + R() * 10, R() * 3, 0, 7); x.fill();
    }
    grime(x, w, h, R, 0.6);
  }, 20);

  T.paint = canvasTex(128, 128, (x, w, h, R) => {   // faded car paint (tinted by material colour)
    x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(${80 + R() * 40},${40 + R() * 20},20,${0.4 + R() * 0.5})`;
      x.beginPath(); x.ellipse(R() * w, R() * h, 2 + R() * 10, 2 + R() * 6, R() * 3, 0, 7); x.fill();
    }
    grime(x, w, h, R, 0.8);
  }, 21);

  // chain-link fence (cut-out)
  T.fence = (() => {
    const t = canvasTex(64, 64, (x, w, h) => {
      x.clearRect(0, 0, w, h);
      x.strokeStyle = '#8a8d91'; x.lineWidth = 2;
      for (let i = -64; i < 128; i += 16) {
        x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 64, 64); x.stroke();
        x.beginPath(); x.moveTo(i + 64, 0); x.lineTo(i, 64); x.stroke();
      }
    }, 22);
    return t;
  })();

  // soft round glow for lamps, eyes, flares and the moon halo
  T.glow = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();

  T.moon = canvasTex(256, 128, (x, w, h, R) => {
    x.fillStyle = '#d9dde8'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      const gx = R() * w, gy = R() * h, r = 2 + R() * 14;
      x.fillStyle = `rgba(110,115,135,${0.2 + R() * 0.35})`;
      x.beginPath(); x.arc(gx, gy, r, 0, 7); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.15)'; x.beginPath(); x.arc(gx - r * 0.2, gy - r * 0.2, r * 0.6, 0, 7); x.fill();
    }
  }, 23);

  // a soft cloud of fog for mist drifting along the streets
  T.mist = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), R = rng(24);
    for (let i = 0; i < 18; i++) {
      const gx = 30 + R() * 68, gy = 30 + R() * 68, r = 20 + R() * 30;
      const g = x.createRadialGradient(gx, gy, 0, gx, gy, r);
      g.addColorStop(0, 'rgba(200,210,230,0.18)'); g.addColorStop(1, 'rgba(200,210,230,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    }
    return new THREE.CanvasTexture(c);
  })();

  return T;
}

// Spray-paint writing on walls. Returns a texture with a transparent background.
export function graffiti(text, color = '#c01020', seed = 5) {
  return canvasTex(512, 192, (x, w, h, R) => {
    x.clearRect(0, 0, w, h);
    x.font = 'bold 84px Impact, "Arial Black", sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = color;
    x.shadowColor = color; x.shadowBlur = 8;
    x.save(); x.translate(w / 2, h / 2); x.rotate((R() - 0.5) * 0.12);
    x.fillText(text, 0, 0, w - 30);
    x.restore();
    x.shadowBlur = 0;
    for (let i = 0; i < 18; i++) {   // drips
      const gx = 40 + R() * (w - 80), gy = h / 2 + 10 + R() * 20, len = 10 + R() * 60;
      x.fillRect(gx, gy, 3, len);
    }
  }, seed);
}

// Big painted sign
export function signTex(lines, bg = '#1c2a22', fg = '#d8d2b8') {
  return canvasTex(512, 256, (x, w, h, R) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.strokeStyle = fg; x.lineWidth = 8; x.strokeRect(12, 12, w - 24, h - 24);
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    lines.forEach((l, i) => {
      x.font = `bold ${l.size || 56}px Georgia, serif`;
      x.fillText(l.text, w / 2, l.y, w - 40);
    });
    grime(x, w, h, R, 1.2);
    for (let i = 0; i < 5; i++) {   // bullet holes and rust
      x.fillStyle = 'rgba(0,0,0,0.8)'; x.beginPath(); x.arc(R() * w, R() * h, 3 + R() * 4, 0, 7); x.fill();
    }
  }, 31);
}
