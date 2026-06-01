import { cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, '../frontend/dist');
const dest = join(root, '../backend/public');

if (!existsSync(src)) {
  console.error('Frontend build not found. Run npm run build -w frontend first.');
  process.exit(1);
}

if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('Copied frontend build to backend/public');
