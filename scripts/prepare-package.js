import { rmSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');

const pathsToRemove = [
  join(ROOT, 'frontend', 'dist'),
  join(ROOT, 'backend', 'public'),
];

for (const target of pathsToRemove) {
  if (!existsSync(target)) {
    console.log(`Omitido (no existe): ${target}`);
    continue;
  }
  rmSync(target, { recursive: true, force: true });
  console.log(`Eliminado: ${target}`);
}

console.log('Listo. Excluí node_modules y .env al crear el zip (ver ENTREGA.md).');
