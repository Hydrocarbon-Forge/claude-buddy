#!/usr/bin/env node
'use strict';
// Generates build/icon.png (1024x1024 RGBA): a cream rounded square with the
// buddy drawn on it. Run from the project root: node scripts/make-icon.js
// Plain Node, no dependencies. The PNG encoder is written by hand.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { drawBuddy, GRID_W, TOP, FEET } = require(path.join(__dirname, '..', 'sprite.js'));

const SIZE = 1024;
const INSET = 40;
const RADIUS = 200;
const BG = [0xf4, 0xed, 0xe4]; // cream
const CELL = 44; // pixels per grid cell
const SS = 4; // supersampling per axis for the rounded edge

// Visible art spans grid rows -6 (top of the party hat) to FEET-1; centre that.
const VISIBLE_TOP = -6;
const VISIBLE_ROWS = FEET - VISIBLE_TOP;
const OX = Math.round((SIZE - GRID_W * CELL) / 2);
const OY = Math.round((SIZE - VISIBLE_ROWS * CELL) / 2) - (VISIBLE_TOP - TOP) * CELL;

const pixels = Buffer.alloc(SIZE * SIZE * 4); // RGBA, starts fully transparent

function insideRoundedRect(x, y) {
  const c = SIZE / 2;
  const half = SIZE / 2 - INSET;
  const inner = half - RADIUS;
  const dx = Math.abs(x - c);
  const dy = Math.abs(y - c);
  if (dx > half || dy > half) return false;
  const qx = Math.max(dx - inner, 0);
  const qy = Math.max(dy - inner, 0);
  return qx * qx + qy * qy <= RADIUS * RADIUS;
}

function paintBackground() {
  const n = SS * SS;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let hits = 0;
      for (let j = 0; j < SS; j++) {
        for (let i = 0; i < SS; i++) {
          if (insideRoundedRect(x + (i + 0.5) / SS, y + (j + 0.5) / SS)) hits++;
        }
      }
      if (hits === 0) continue;
      const k = (y * SIZE + x) * 4;
      pixels[k] = BG[0];
      pixels[k + 1] = BG[1];
      pixels[k + 2] = BG[2];
      pixels[k + 3] = Math.round((hits / n) * 255);
    }
  }
}

function parseHex(hex) {
  const h = String(hex || '#D97757').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const v = parseInt(full, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// plot(x, y, w, h, hex) in grid cells; later calls overwrite earlier ones.
function plot(gx, gy, w, h, hex) {
  const [r, g, b] = parseHex(hex);
  const x0 = OX + gx * CELL;
  const x1 = x0 + w * CELL;
  const y0 = OY + (gy - TOP) * CELL;
  const y1 = y0 + h * CELL;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const k = (y * SIZE + x) * 4;
      pixels[k] = r;
      pixels[k + 1] = g;
      pixels[k + 2] = b;
      pixels[k + 3] = 255;
    }
  }
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // no interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type 0 (None)
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

paintBackground();
drawBuddy(plot, { color: '#D97757', hat: 'party', pose: 'idle' });

const outDir = path.join(__dirname, '..', 'build');
const outFile = path.join(outDir, 'icon.png');
fs.mkdirSync(outDir, { recursive: true });
const png = encodePng(SIZE, SIZE, pixels);
fs.writeFileSync(outFile, png);
console.log(`Wrote ${outFile} (${SIZE}x${SIZE}, ${png.length} bytes)`);
