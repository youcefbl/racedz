# Agent Notes For RaceDZ

Before changing code, read `TODO.md` and `CODEX_CONTEXT.md`. `TODO.md` is the single source of truth for planning and requirements.

`backlog.md` and `requirment.md` are intentionally only pointers to `TODO.md`; do not add planning content there.

Keep the MVP focused:

- Use tokens carefully. Read `TODO.md` and `CODEX_CONTEXT.md` first, then use `rg`/targeted file reads for the specific feature instead of loading broad unrelated files.
- Do not repeatedly reread large files unless they changed or the task depends on exact text.
- Keep progress updates concise and only include what affects the current implementation.
- Prefer implementing the next concrete task over restating long plans.
- In final answers, summarize the outcome, verification, and next useful step without dumping full command output.
- Use the existing Next.js App Router structure.
- Prefer typed helpers in `src/lib` over duplicating domain logic in pages.
- Prefer server-side authorization and shared domain helpers for protected workflows.
- Keep public UI mobile-first and bilingual-ready.
- For every UI change, apply 2026-ready product UI best practices: clean minimalist layout, strong visual hierarchy, accessible controls, and runner-focused flashes of energetic color.
- Maintain the three visual modes: light, dark, and race. Race mode should use flashy runner colors such as lime green, hot pink, and purple without sacrificing readability.
- Avoid clutter, decorative-only sections, and generic SaaS/landing-page filler. Race discovery should feel sporty and lively; dashboards should stay calm, dense, and operational.
- When making UI choices, default to the clearest minimalist option. Ask the user only when the decision affects product behavior, brand identity, or a major layout direction.
- Use Zod for request validation.
- Enforce role checks on the server for every protected page, route handler, and server action.
- Treat OWASP Top 10 security, safe redirects, minimal data exposure, and secret handling as baseline quality requirements.
- Use pagination, narrow `select`, aggregate/count queries, and indexes where list/dashboard performance matters.
- Run `npm run lint`, `npm run typecheck`, and `npm run build` after meaningful code changes. For docs-only changes, do a targeted content check instead.
- Add focused tests when changing shared domain logic, authorization, registration, payments, organization membership, or admin approvals.
- Do not add payment gateway integration yet; keep manual payment status fields.
- Do not build registration resale/marketplace yet. Keep it deferred until transfer, fraud, organizer approval, and payment rules are specified.
- Do not commit `.env` files or uploaded user files.
