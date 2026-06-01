# Mundial 2026 — El Juego de Predicciones

Aplicación web para predecir resultados del Mundial 2026, con puntuación automática y ranking en **tiempo real** vía WebSockets.

> **Entrega a otro desarrollador:** ver [ENTREGA.md](./ENTREGA.md) (setup, base de datos, qué incluir en el zip, arquitectura).

## Stack

- **Backend:** Node.js, Express, MongoDB, JWT, WebSockets (`ws`)
- **Frontend:** React, Vite, Tailwind CSS, shadcn/ui (zinc)
- **API de datos:** [rezarahiminia/worldcup2026](https://github.com/rezarahiminia/worldcup2026) → [worldcup26.ir](https://worldcup26.ir/api-docs/)
- **Deploy:** Heroku + MongoDB Atlas

## Skills del proyecto

Instaladas en `.agents/skills/`:

- `shadcn` — componentes UI
- `tdd` — desarrollo guiado por tests
- `vercel-react-best-practices` — buenas prácticas React

## Requisitos

- Node.js 18+
- MongoDB (local o Atlas)

## Configuración

```bash
cp .env.example .env
# Editar .env con MONGODB_URI, JWT_SECRET y credenciales de sync
```

### API externa (104 partidos, 48 equipos)

Registra un usuario en [worldcup26.ir](https://worldcup26.ir) y configura:

```env
WORLD_CUP_SYNC_EMAIL=tu@email.com
WORLD_CUP_SYNC_PASSWORD=tu_password
```

Sin credenciales, la app arranca con **datos demo** (2 partidos de prueba).

## Desarrollo

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- WebSocket: ws://localhost:5000/ws

## Tests (puntuación — TDD)

```bash
npm test
```

Reglas implementadas en `calculatePoints`:

| Regla | Puntos |
|-------|--------|
| Resultado ganador (incluye empate) | +3 |
| Goles local exactos | +1 |
| Goles visitante exactos | +1 |
| Total de goles (volumen) | +1 |

## Sync manual

```bash
npm run sync
```

## Reset de base de datos

```bash
npm run reset-db      # vacía todas las colecciones MongoDB
npm run prepare-package   # elimina dist/ y backend/public/ antes de zippear
```

## Producción / Heroku

```bash
heroku config:set MONGODB_URI=... JWT_SECRET=... WORLD_CUP_SYNC_EMAIL=... WORLD_CUP_SYNC_PASSWORD=...
heroku config:set CLIENT_ORIGIN=https://tu-app.herokuapp.com

git push heroku main
```

El backend sirve el frontend compilado desde `backend/public` tras `heroku-postbuild`.
