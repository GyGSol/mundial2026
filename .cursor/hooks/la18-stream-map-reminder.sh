#!/usr/bin/env bash
# Recuerda mapear transmisiones La18HD al iniciar sesión en este proyecto.
set -euo pipefail

AGENDA_URL="https://la18hd.com/eventos/json/agenda123.json"
status="ok"
agenda_hint=""

if command -v curl >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
  if response=$(curl -fsS --max-time 8 "$AGENDA_URL" \
    -H "Referer: https://la18hd.com/eventos/" \
    -H "Accept: application/json" 2>/dev/null); then
    count=$(printf '%s' "$response" | node -e "
      let d='';
      process.stdin.on('data', (c) => { d += c; });
      process.stdin.on('end', () => {
        try {
          const rows = JSON.parse(d).filter((r) => r.category === 'Futbol');
          process.stdout.write(String(rows.length));
        } catch {
          process.stdout.write('0');
        }
      });
    ")
    agenda_hint=" Agenda La18HD accesible (${count} eventos fútbol hoy)."
  else
    status="agenda_unreachable"
    agenda_hint=" No se pudo leer la agenda La18HD."
  fi
else
  agenda_hint=" (curl/node no disponibles en el entorno del hook)."
fi

cat <<EOF
{
  "continue": true,
  "additional_context": "Mundial2026 — transmisiones en vivo: la agenda está en https://la18hd.com/eventos/ (JSON: /eventos/json/agenda123.json).${agenda_hint} Tras cambios en la18hdScraper o stream links, ejecutar: npm run sync:streams. Estado agenda: ${status}."
}
EOF
