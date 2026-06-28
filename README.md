# ZidRun

ZidRun is an MVP web platform for discovering, registering for, and managing running events across Algeria.

## Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- Auth.js / NextAuth credentials authentication

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create local environment values:

   ```bash
   cp .env.example .env
   ```

3. Start local PostgreSQL:

   ```bash
   docker compose up -d postgres
   ```

4. Generate Prisma client, run migrations, and seed demo data:

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   npm run prisma:seed
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

   Use the fixed local URL:

   ```text
   http://127.0.0.1:3003
   ```

Demo accounts seeded by `npm run prisma:seed`:

- `admin@zidrun.com`
- `organizer@zidrun.com`
- `runner@example.com`

All use password `racedz-demo-password`.

## Project Context

- Planning and requirements source of truth: `TODO.md`
- Historical product brief: `algeria-races-codex-brief.md`
- Quick Codex context: `CODEX_CONTEXT.md`
- Agent instructions: `AGENTS.md`
- Manual QA flow: `docs/QA_CHECKLIST.md`
- Browser e2e test strategy: `docs/E2E_TEST_STRATEGY.md`
- AWS deployment plan and cost estimate: `docs/AWS_DEPLOYMENT_PLAN.md`

## Quality Checks

Run these after meaningful code changes:

```bash
npm run lint
npm run typecheck
npm run build
```

For a quick local route check, keep `npm run dev` running on `http://127.0.0.1:3003`, then run:

```bash
npm run smoke
```

## Two-PC Development

Use Git as the source of truth for code. Commit and push before switching PCs, then pull on the other PC.

Keep `.env` local on each machine. Recreate local data with Docker, Prisma migrations, and seed data unless you explicitly need to export/import the exact same PostgreSQL data.

Detailed setup guide: `NEW_PC_SETUP.md`
