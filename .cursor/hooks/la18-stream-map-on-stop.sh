#!/usr/bin/env bash
# Tras tocar código de transmisiones, sugerir sync de mappings La18HD.
set -euo pipefail

cat <<'EOF'
{
  "followup_message": "Si cambiaste el scraper o mappings de La18HD, ejecutá `npm run sync:streams` (o `npm run sync:streams -- --dry-run` para revisar) y verificá transmisiones en /transmissions."
}
EOF
