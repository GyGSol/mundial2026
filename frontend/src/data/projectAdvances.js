/**
 * Avances del proyecto — fuente única para el panel admin y documentación.
 * Imágenes en /admin/avances/ (frontend/public/admin/avances/).
 */
export const PROJECT_ADVANCES = [
  {
    id: 'live',
    title: 'Ranking y datos en vivo',
    image: '/admin/avances/avance-ranking-vivo.png',
    items: [
      'Puntuación y ranking en vivo al arrancar el partido (rescoring periódico).',
      'Barra de partidos en vivo en /ranking: minuto, goleadores, tarjetas y cambios.',
      'Timeline oficial FIFA en partidos terminados y resumen con stats del reporte.',
      'Tablas de grupo en vivo con puntos actualizados durante el partido.',
      'Sync acelerado (15 s) mientras hay partidos live; kickoff watch cada 15 s.',
      'Eventos en vivo vía Football-Data.org (tarjetas, sustituciones).',
    ],
  },
  {
    id: 'predictions',
    title: 'Predicciones y puntuación',
    image: '/admin/avances/avance-predicciones.png',
    items: [
      'Cierre automático 1 h antes del kickoff; 0-0 si no hay predicción.',
      'Puntos: +3 resultado, +1 goles local/visitante, +1 total de goles.',
      'Punto consuelo (PB) tras 3 partidos seguidos sin puntos.',
      'Partidos agrupados por fase; equipos resueltos en fase final.',
      'Agenda ICS con cierre de predicción y tabla del grupo activo.',
      'Simulación quick (demo) y full (72 grupos + 32 eliminatorias).',
    ],
  },
  {
    id: 'worldcup',
    title: 'Mundial, estadios y jugadores',
    image: '/admin/avances/avance-mundial-stats.png',
    items: [
      '48 equipos, 12 grupos FIFA, 104 partidos y 16 estadios con zona horaria IANA.',
      'Fotos reales de estadios (Commons), popup de detalles y bracket de fase final.',
      'Tabla de mejores terceros y simulación de fase final en Mis tablas.',
      'Historia del Mundial desde Wikipedia; goleadores históricos y 2026.',
      'Enciclopedia de Jugadores (Beta): lineups, lesiones, sync Football-Data.org.',
      'Broadcasters por partido y kickoff en zona horaria del navegador.',
    ],
  },
  {
    id: 'groups',
    title: 'Grupos de competencia',
    image: '/admin/avances/avance-grupos-amigos.png',
    items: [
      'Varios grupos por usuario; ranking global, por grupo o sin grupo.',
      'Crear, unirse por invitación, premios y cantidad de ganadores.',
      'Admin del grupo: editar, expulsar miembros, aprobar solicitudes.',
      'Landing de bienvenida con acceso a Ingresar y Registrarse.',
    ],
  },
  {
    id: 'admin',
    title: 'Panel de administración',
    image: '/admin/avances/avance-panel-admin.png',
    items: [
      'Setup inicial, login JWT y rutas protegidas /admin/*.',
      'Resumen con stats de DB, sync y contadores por estado de partido.',
      'CRUD de usuarios (contraseña, puntos, perfil), grupos y membresías.',
      'Edición de partidos, predicciones y recálculo de puntuación.',
      'Sync manual de partidos y jugadores; simulación en vivo desde admin.',
      'Predicciones editadas en admin visibles al usuario de inmediato.',
    ],
  },
];

export const PROJECT_STACK = {
  backend: 'Node.js, Express, MongoDB, JWT, WebSockets (ws)',
  frontend: 'React, Vite, Tailwind CSS, shadcn/ui (zinc)',
  dataApis: 'worldcup26.ir + Football-Data.org (eventos y jugadores)',
  deploy: 'Heroku (mundial2026-pred) + MongoDB Atlas',
};
