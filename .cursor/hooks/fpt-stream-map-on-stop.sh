#!/usr/bin/env bash
# Tras tocar código de transmisiones, sugerir sync de mappings FPT.
set -euo pipefail

cat <<'EOF'
{
  "followup_message": "Si cambiaste el scraper o mappings de Fútbol para Todos, ejecutá `npm run sync:streams` (o `npm run sync:streams -- --dry-run` para revisar) y verificá transmisiones en /transmissions."
}
EOF
