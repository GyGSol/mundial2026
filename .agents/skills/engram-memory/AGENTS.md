# engram-memory

When using Engram in Mundial2026, follow [SKILL.md](./SKILL.md) before `mem_save`, `mem_session_summary`, or `mem_judge`.

**Hard rules**

- Project: `mundial2026`. Data dir: repo `.engram/` (via MCP env).
- Proactive `mem_save` after bugfixes, decisions, and non-obvious discoveries.
- Always use structured content (`**What**` / `**Why**` / `**Where**` / `**Learned**`) and `topic_key` under `mundial2026/<domain>/<slug>`.
- Never persist secrets, tokens, connection strings, or user PII.
