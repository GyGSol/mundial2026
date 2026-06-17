import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, '../scripts/exportTrainingBuffer.js');

export async function exportTrainingBufferJob() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../../..'),
    });
    child.on('exit', (code) => {
      if (code === 0) resolve({ ok: true });
      else reject(new Error(`exportTrainingBuffer exited with ${code}`));
    });
  });
}
