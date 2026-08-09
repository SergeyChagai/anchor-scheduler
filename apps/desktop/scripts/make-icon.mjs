/**
 * Renders the app icon (the same three-anchors-on-a-day-line mark as
 * apps/web/public/icon.svg) to a 1024px PNG, which `tauri icon` then fans out
 * into every platform size. Hand-rolled so the icon set stays reproducible
 * from source without pulling in an image toolchain.
 *
 *   node scripts/make-icon.mjs      -> src-tauri/icons/source.png
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 1024;
const SS = 3; // supersampling factor, for smooth edges
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src-tauri",
  "icons",
  "source.png",
);

const rgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const BG = rgb("#14161a");
const LINE = rgb("#2e333c");
const ACCENT = rgb("#7aa2f7");
const OK = rgb("#7bd88f");

/** Scale from the 512-unit SVG viewBox to icon pixels. */
const u = (n) => (n * SIZE) / 512;

const inRoundedRect = (x, y, r) => {
  const cx = Math.min(Math.max(x, r), SIZE - r);
  const cy = Math.min(Math.max(y, r), SIZE - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
};

const inCircle = (x, y, cx, cy, r) =>
  (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r;

/** Colour of the mark at a point, or null where the icon is transparent. */
function sample(x, y) {
  if (!inRoundedRect(x, y, u(96))) return null;
  for (const [cy, color] of [
    [u(140), ACCENT],
    [u(256), OK],
    [u(372), ACCENT],
  ]) {
    if (inCircle(x, y, u(256), cy, u(38))) return color;
  }
  // the day line, with rounded caps
  const halfW = u(10);
  const top = u(96);
  const bottom = u(416);
  const onStem = Math.abs(x - u(256)) <= halfW && y >= top && y <= bottom;
  const onCap =
    inCircle(x, y, u(256), top, halfW) || inCircle(x, y, u(256), bottom, halfW);
  if (onStem || onCap) return LINE;
  return BG;
}

const pixels = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let r = 0;
    let g = 0;
    let b = 0;
    let hits = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const c = sample(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS);
        if (!c) continue;
        r += c[0];
        g += c[1];
        b += c[2];
        hits++;
      }
    }
    const i = (y * SIZE + x) * 4;
    const total = SS * SS;
    if (hits === 0) continue; // transparent
    pixels[i] = Math.round(r / hits);
    pixels[i + 1] = Math.round(g / hits);
    pixels[i + 2] = Math.round(b / hits);
    pixels[i + 3] = Math.round((hits / total) * 255);
  }
}

/* ---- minimal PNG container ---------------------------------------------- */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // colour type: RGBA
// 10..12 stay zero: deflate, adaptive filtering, no interlace

// One filter byte (type 0 = none) per scanline.
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (SIZE * 4 + 1);
  raw[rowStart] = 0;
  pixels.copy(raw, rowStart + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, png);
console.log(`wrote ${OUT} (${SIZE}x${SIZE}, ${(png.length / 1024).toFixed(1)} kB)`);
