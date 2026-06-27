#!/usr/bin/env bash
# Recuerda mapear transmisiones FPT al iniciar sesión en este proyecto.
set -euo pipefail

AGENDA_URL="https://futbolparatodos.su/agenda.php"
status="ok"
agenda_hint=""

if command -v curl >/dev/null 2>&1; then
  if response=$(curl -fsS --max-time 8 "$AGENDA_URL" \
    -H "Referer: https://futbolparatodos.su/" \
    -H "Accept: text/html" 2>/dev/null); then
    count=$(printf '%s' "$response" | grep -c 'class="FIFA"' || true)
    agenda_hint=" Agenda FPT accesible (${count} eventos FIFA en agenda)."
  else
    status="agenda_unreachable"
    agenda_hint=" No se pudo leer la agenda FPT."
  fi
else
  agenda_hint=" (curl no disponible en el entorno del hook)."
fi

cat <<EOF
{
  "continue": true,
  "additional_context": "Mundial2026 — transmisiones en vivo: la agenda está en https://futbolparatodos.su/agenda.php.${agenda_hint} Tras cambios en fptScraper o stream links, ejecutar: npm run sync:streams. Estado agenda: ${status}."
}
EOF
