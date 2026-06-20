#!/usr/bin/env bash
# Referencia para agentes: bloquear deploy directo a prod sin confirmación del usuario.
# Cursor no expone PreToolUse en hooks.json; la skill heroku-deploy documenta el flujo.
#
# Uso manual (opcional, en scripts propios):
#   .cursor/hooks/block-production-deploy.sh "git push heroku main"

set -euo pipefail

COMMAND="${1:-}"

if echo "$COMMAND" | grep -qE 'git push (heroku main|heroku HEAD:main)|heroku pipelines:promote'; then
  echo "BLOCKED: deploy a producción requiere confirmación del usuario." >&2
  echo "Flujo: npm run dev:local-qa → checklist → CONFIRM_PRODUCTION=1 npm run deploy:production" >&2
  exit 2
fi

exit 0
