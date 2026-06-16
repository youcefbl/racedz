# Agent Notes For RaceDZ

Before changing code, read `TODO.md` and `CODEX_CONTEXT.md`. `TODO.md` is the single source of truth for planning and requirements.

`backlog.md` and `requirment.md` are intentionally only pointers to `TODO.md`; do not add planning content there.

Keep the MVP focused:

- Use the existing Next.js App Router structure.
- Prefer typed helpers in `src/lib` over duplicating domain logic in pages.
- Keep public UI mobile-first and bilingual-ready.
- For every UI change, apply 2026-ready product UI best practices: clean minimalist layout, strong visual hierarchy, accessible controls, and runner-focused flashes of energetic color.
- Maintain the three visual modes: light, dark, and race. Race mode should use flashy runner colors such as lime green, hot pink, and purple without sacrificing readability.
- Avoid clutter, decorative-only sections, and generic SaaS/landing-page filler. Race discovery should feel sporty and lively; dashboards should stay calm, dense, and operational.
- When making UI choices, default to the clearest minimalist option. Ask the user only when the decision affects product behavior, brand identity, or a major layout direction.
- Use Zod for request validation.
- Enforce role checks on the server when auth is implemented.
- Do not add payment gateway integration yet; keep manual payment status fields.
- Do not commit `.env` files or uploaded user files.
