import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');
const sourcePath = path.join(publicDir, 'world-cup-trophy.png');

const OUTPUTS = [
  ['favicon-32.png', 32],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
];

function knockOutBlackBackground({ data, info }) {
  const pixels = new Uint8Array(data);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const isNearBlack = max < 42 && min < 28;
    if (isNearBlack) {
      pixels[i + 3] = 0;
    }
  }
  return sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels: 4 },
  });
}

async function buildTrophyCanvas(size) {
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const trimmed = await knockOutBlackBackground({ data, info })
    .trim({ threshold: 8 })
    .toBuffer({ resolveWithObject: true });

  const padding = Math.max(2, Math.round(size * 0.04));
  const inner = size - padding * 2;

  return sharp(trimmed.data, {
    raw: {
      width: trimmed.info.width,
      height: trimmed.info.height,
      channels: trimmed.info.channels,
    },
  })
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true });
}

async function main() {
  await readFile(sourcePath);

  for (const [filename, size] of OUTPUTS) {
    const outPath = path.join(publicDir, filename);
    const pipeline = await buildTrophyCanvas(size);
    const buffer = await pipeline.toBuffer();
    await writeFile(outPath, buffer);
    console.log(`wrote ${filename} (${size}x${size})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
