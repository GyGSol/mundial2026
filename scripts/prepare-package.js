import { rmSync, existsSync, writeFileSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const ROOT = join(import.meta.dirname, '..');
const ZIP_NAME = 'mundial2026-entrega.zip';
const FILE_LIST = join(ROOT, '.package-zip-files.txt');

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

const zipPath = join(ROOT, ZIP_NAME);
if (existsSync(zipPath)) {
  rmSync(zipPath, { force: true });
  console.log(`Eliminado zip anterior: ${zipPath}`);
}

const findCmd = [
  'find . -type f',
  '! -path "*/node_modules/*"',
  '! -path "./frontend/dist/*"',
  '! -path "./backend/public/*"',
  '! -path "./.git/*"',
  `! -name '${ZIP_NAME}'`,
  "! -name '.env'",
  "! -name '*.log'",
  "! -name '.DS_Store'",
  "! -name '.package-zip-files.txt'",
].join(' ');

console.log('Listando archivos para el zip...');
const files = execSync(findCmd, { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

writeFileSync(FILE_LIST, files.join('\n'));
console.log(`Archivos a incluir: ${files.length}`);

console.log('Creando zip de entrega...');
execSync(`zip ${ZIP_NAME} -@ < .package-zip-files.txt`, {
  cwd: ROOT,
  shell: true,
  stdio: 'inherit',
});

unlinkSync(FILE_LIST);

const sizeKb = Math.round(statSync(zipPath).size / 1024);
console.log(`Listo: ${ZIP_NAME} (${sizeKb} KB, ${files.length} archivos)`);
console.log('El receptor: cp .env.example .env → npm install → npm run sync');
