import { spawnSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { env } from '../config/env.js';

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function main() {
  const uri = env.mongodbUri;
  if (!uri) {
    console.error('MONGODB_URI no configurado');
    process.exit(1);
  }

  const outDir = join(process.cwd(), 'backups', `pre-fubols-${timestamp()}`);
  mkdirSync(outDir, { recursive: true });

  console.log(`Backup → ${outDir}`);
  const result = spawnSync('mongodump', ['--uri', uri, '--out', outDir], {
    stdio: 'inherit',
    encoding: 'utf8',
  });

  if (result.error?.code === 'ENOENT') {
    console.error(
      'mongodump no está instalado. Instalá MongoDB Database Tools o usá un snapshot manual en Atlas.'
    );
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error('mongodump falló');
    process.exit(result.status || 1);
  }

  console.log('Backup completado.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
