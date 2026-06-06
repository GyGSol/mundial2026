# Skill Registry — Mundial 2026

> Generado para `/home/magnetico/Nexus/Mundial2026`. Skills en `.agents/skills/` + globales en `~/.cursor/skills/`.

## Tabla de disparadores

| Trigger | Skill | Path |
|---------|-------|------|
| shadcn, components.json | shadcn | `.agents/skills/shadcn/SKILL.md` |
| TDD, red-green-refactor | tdd | `.agents/skills/tdd/SKILL.md` |
| React/Next performance | vercel-react-best-practices | `.agents/skills/vercel-react-best-practices/SKILL.md` |
| compound components, boolean props | vercel-composition-patterns | `.agents/skills/vercel-composition-patterns/SKILL.md` |
| view transitions, route animation | vercel-react-view-transitions | `.agents/skills/vercel-react-view-transitions/SKILL.md` |
| deploy to vercel | deploy-to-vercel | `.agents/skills/deploy-to-vercel/SKILL.md` |
| vercel token CLI | vercel-cli-with-tokens | `.agents/skills/vercel-cli-with-tokens/SKILL.md` |
| vercel bill, slow routes | vercel-optimize | `.agents/skills/vercel-optimize/SKILL.md` |
| diagnose, debug, regression | diagnose | `.agents/skills/diagnose/SKILL.md` |
| review branch/PR | review | `.agents/skills/review/SKILL.md` |
| UI audit, accessibility | web-design-guidelines | `.agents/skills/web-design-guidelines/SKILL.md` |
| PR creation | branch-pr | `~/.cursor/skills/branch-pr/SKILL.md` |
| issue creation | issue-creation | `~/.cursor/skills/issue-creation/SKILL.md` |
| caveman, less tokens | caveman | `.agents/skills/caveman/SKILL.md` |

## Compact rules (proyecto)

### shadcn
- Usar CLI y `components.json` del frontend; no copiar componentes a mano sin alinear tokens.
- Preferir composición sobre props booleanas en wrappers UI.

### tdd
- Ciclo red → green → refactor en backend (`backend/tests/`).
- Tests de comportamiento real, no asserts triviales.

### vercel-react-best-practices
- Evitar waterfalls en fetch; `Promise.all` para operaciones independientes.
- Suspense boundaries estratégicos; serializar mínimo en RSC boundaries (N/A parcial en Vite SPA).
- No barrel imports pesados; memo solo cuando el compilador no lo cubre.

### vercel-composition-patterns
- Evitar proliferación de props booleanas; compound components + providers.
- React 19: `use()` en lugar de `useContext`; ref como prop normal.

### diagnose
- Reproducir → minimizar → hipótesis → instrumentar → fix → test de regresión.

### mundial2026 (dominio)
- Puntuación y predicciones: reglas en backend; sync vía worldcup26.ir.
- Heroku app: `mundial2026-pred`; ruta repo: `/home/magnetico/Nexus/Mundial2026`.
