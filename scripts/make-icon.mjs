// Generates the VeraMark application icon PNG (1024x1024, no external deps).
// Usage: node scripts/make-icon.mjs <output-path>
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SIZE = 1024;

const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// --- geometry helpers -------------------------------------------------------

function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  return Math.hypot(px - cx, py - cy);
}

function roundedContains(x, y, left, top, right, bottom, radius) {
  if (x < left || x > right || y < top || y > bottom) return false;
  const minX = left + radius;
  const maxX = right - radius;
  const minY = top + radius;
  const maxY = bottom - radius;
  if (x >= minX && x <= maxX) return true;
  if (y >= minY && y <= maxY) return true;
  const cx = x < minX ? minX : maxX;
  const cy = y < minY ? minY : maxY;
  return Math.hypot(x - cx, y - cy) <= radius;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// --- pixel coloring --------------------------------------------------------

const px = new Uint8ClampedArray(SIZE * SIZE * 4);
const ACCENT_HI = [14, 165, 233]; // sky-500
const ACCENT_LO = [34, 211, 238]; // cyan-400

for (let y = 0; y < SIZE; y++) {
  const t = y / SIZE;
  for (let x = 0; x < SIZE; x++) {
    const idx = (y * SIZE + x) * 4;

    // Rounded-square badge background with vertical accent gradient.
    const inBadge = roundedContains(x + 0.5, y + 0.5, 100, 110, 924, 914, 220);
    if (!inBadge) {
      px[idx] = 24;
      px[idx + 1] = 24;
      px[idx + 2] = 27;
      px[idx + 3] = 255;
      continue;
    }

    // Subtle inner highlight rectangle.
    const inInner = roundedContains(x + 0.5, y + 0.5, 148, 158, 876, 866, 170);
    if (!inInner) {
      px[idx] = 39;
      px[idx + 1] = 39;
      px[idx + 2] = 42;
      px[idx + 3] = 255;
      continue;
    }

    let r = lerp(ACCENT_LO[0], ACCENT_HI[0], t);
    let g = lerp(ACCENT_LO[1], ACCENT_HI[1], t);
    let b = lerp(ACCENT_LO[2], ACCENT_HI[2], t);

    // "Verified" check mark composed of two thick line segments.
    const seg1 = distToSegment(x + 0.5, y + 0.5, 320, 520, 470, 670);
    const seg2 = distToSegment(x + 0.5, y + 0.5, 470, 670, 735, 390);
    if (seg1 < 52 || seg2 < 52) {
      r = 250;
      g = 250;
      b = 250;
    } else {
      // Soft vignette toward badge edges.
      const edge = Math.max(
        Math.abs(x - SIZE / 2) / (SIZE / 2),
        Math.abs(y - SIZE / 2) / (SIZE / 2),
      ) ** 1.6;
      r = lerp(r, 5, edge * 0.45);
      g = lerp(g, 8, edge * 0.45);
      b = lerp(b, 12, edge * 0.45);
    }

    px[idx] = r;
    px[idx + 1] = g;
    px[idx + 2] = b;
    px[idx + 3] = 255;
  }
}

// --- PNG encoding ----------------------------------------------------------

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (SIZE * 4 + 1);
  raw[rowStart] = 0; // filter: none
  Buffer.from(px.buffer, y * SIZE * 4, SIZE * 4).copy(raw, rowStart + 1);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
ihdr[12] = 0; // (10=interlace, 11=compression, 12=filter) -> 0

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const outPath = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "app-icon.png");
writeFileSync(outPath, png);
console.log(`wrote ${outPath} (${png.length} bytes)`);