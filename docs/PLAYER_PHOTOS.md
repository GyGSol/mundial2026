# Caricaturas de jugadores y DT

Flujo obligatorio para subir fotos de planteles. Las imágenes **no van en Heroku** ni en MongoDB como binarios: viven en GitHub y la app arma URLs desde `photoKey` + manifiesto.

| Qué | Dónde |
|-----|--------|
| PNG | `imagenes-jugadores/{carpeta}/{fifa3}-{slug}.png` |
| Listas generador | `imagenes-jugadores/generador/{prefijo}.txt` |
| Manifiesto (prod) | `backend/src/data/playerPhotoManifest.json` |
| Referencia Mongo | `Player.photoKey` (solo jugadores) |
| URL en prod | GitHub raw (`PLAYER_PHOTOS_GITHUB_BASE`) |

```text
https://raw.githubusercontent.com/GyGSol/mundial2026/main/imagenes-jugadores
```

---

## Regla obligatoria: comprimir antes de subir

**Nunca** hagas `git push` de PNG generados sin comprimir. Los archivos del generador suelen pesar **~1–1,5 MB** cada uno (1162×972 RGBA). Comprimidos pesan **~80–120 KB** (512px, palette) con calidad visual suficiente para la app.

Parámetros por defecto (piloto jun-2026, **no cambiar sin motivo**):

| Parámetro | Valor | Efecto |
|-----------|-------|--------|
| `--width` | `512` | Máximo 512px (sin agrandar si ya es más chico) |
| `--quality` | `75` | PNG palette |
| Resultado típico | ~90 % menos peso | 988 fotos: ~1,2 GB → ~107 MB |

Los originales sin comprimir se guardan en `imagenes-jugadores/.originals/{carpeta}/` (gitignored) por si hay que re-exportar.

---

## Subir una selección nueva

Ejemplo: Austria (`imagenes-jugadores/austria/`, prefijo `aut-`, FIFA `AUT`).

### 1. Generar caricaturas

- Lista en `imagenes-jugadores/generador/aut.txt` (jugadores + línea DT).
- Formato jugador: `aut-nombre.png | #dorsal | Nombre | POS | …`
- Formato DT: `aut-ralf-rangnick.png | — | Ralf Rangnick | DT`
- Guardar PNG en `imagenes-jugadores/austria/`.

### 2. Comprimir (obligatorio)

```bash
npm run photos:compress -- austria
# Vista previa sin escribir:
npm run photos:compress -- austria --dry-run
```

### 3. Commit y push (solo la carpeta nueva)

```bash
git add imagenes-jugadores/austria/ imagenes-jugadores/generador/aut.txt
# Si es la primera vez de esa selección, agregar mapeo en:
#   backend/src/services/playerPhotoService.js  (TEAM_FOLDER_TO_FIFA)
#   backend/src/data/wikipediaSquadCountryMap.js (FIFA_TO_PHOTO_FOLDER)
git commit -m "Subir caricaturas Austria (AUT), comprimidas."
git push origin main
```

**No uses** `git add -A` ni `git add imagenes-jugadores/` a ciegas: después de `photos:clean-local` el working tree muestra miles de `D` que no deben commitearse.

### 4. Manifiesto

Tras el push, regenerar desde `origin/main`:

```bash
npm run photos:build-manifest
git add backend/src/data/playerPhotoManifest.json
git commit -m "Manifiesto: incluir fotos de Austria."
git push origin main
```

El manifiesto evita URLs 404 en prod cuando el PNG aún no está en GitHub.

### 5. Deploy (solo si cambió backend)

Si solo cambiaron PNG en GitHub, **no hace falta** redeploy de Heroku. Si cambió el manifiesto o código (`playerPhotoService.js`, etc.):

```bash
CONFIRM_PRODUCTION=1 npm run deploy:production
```

### 6. Sincronizar MongoDB

```bash
MONGODB_URI="$(heroku config:get MONGODB_URI -a mundial2026-pred)" npm run sync:player-photos
```

Escribe `photoKey` en jugadores. Los DT no van a Mongo: la URL se arma en runtime con `buildCoachPhotoKey`.

### 7. Limpiar disco local (opcional)

Solo **después** de confirmar que los PNG están en `origin/main`:

```bash
npm run photos:clean-local
```

Borra PNG locales que ya están en GitHub. **No commitear** los borrados resultantes.

---

## Comprimir todo lo publicado

Para re-comprimir todas las carpetas que ya están en `origin/main`:

```bash
git fetch origin main
git checkout origin/main -- imagenes-jugadores/   # restaurar PNG si clean-local los borró
npm run photos:compress -- --all-published
git add -u imagenes-jugadores/
git commit -m "Re-comprimir caricaturas publicadas."
git push origin main
```

`git add -u` solo toca archivos **trackeados**; no incluye carpetas nuevas sin subir (ej. Irak, Senegal en staging).

---

## Comandos npm

| Comando | Uso |
|---------|-----|
| `npm run photos:compress -- <carpeta>` | Comprimir una selección |
| `npm run photos:compress -- --all-published` | Todas las carpetas en `origin/main` |
| `npm run photos:compress -- <carpeta> --dry-run` | Estimar tamaño sin escribir |
| `npm run photos:build-manifest` | Regenerar `playerPhotoManifest.json` |
| `npm run sync:player-photos` | Emparejar PNG ↔ jugadores en Mongo |
| `npm run photos:clean-local` | Borrar PNG locales ya en GitHub |

Opciones del script: `--width`, `--quality`, `--no-keep-original`.

Implementación: [`scripts/compress-player-photos.mjs`](../scripts/compress-player-photos.mjs).

---

## Convención de nombres

- Carpeta: español, kebab-case (`inglaterra`, `costa-de-marfil`, `rd-congo`).
- Archivo: `{fifa3}-{slug-nombre}.png` (minúsculas, sin acentos).
- DT: misma convención (`fra-didier-deschamps.png`, `arg-lionel-scaloni.png`).

Mapeos carpeta ↔ FIFA en `playerPhotoService.js` y `wikipediaSquadCountryMap.js`.

---

## Errores frecuentes

| Síntoma | Causa | Solución |
|---------|--------|----------|
| Foto en blanco / iniciales | PNG no en GitHub o no en manifiesto | Comprimir, push, `photos:build-manifest`, deploy si cambió manifiesto |
| `git push heroku` falla por repo enorme | PNG en commit de deploy | Usar `npm run deploy:production` (excluye `imagenes-jugadores/`) |
| Commit borra miles de PNG | `git add -A` tras `photos:clean-local` | Stage solo carpetas nuevas; `git add -u` solo al re-comprimir todo |
| Duplicados en listado (fd- vs XXX-) | Football-Data + Wikipedia | Ya deduplicado en API por selección; sync propaga `photoKey` |

---

## Referencias

- Deploy y QA: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Agentes: [AGENTS.md](../AGENTS.md)
- Código: `backend/src/services/playerPhotoService.js`
