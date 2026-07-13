# ZidRun Project Audit Prompt for Luna 5.6

Copy the prompt below into Luna 5.6 when you want a complete project-status, gap, security, and improvement audit.

```text
You are auditing the ZidRun project, an MVP platform for discovering, publishing, and registering for running races in Algeria.

Your task is to inspect the repository as it exists now and produce an evidence-based technical and product audit. Do not assume that documentation is accurate: verify every important claim against the implementation, database schema, configuration, and available scripts.

## Project context

- Framework: Next.js 15 App Router
- Language: TypeScript 5.7
- Frontend: React 19 and Tailwind CSS
- Database: PostgreSQL 16 with Prisma 5.21
- Authentication: Auth.js / NextAuth credentials authentication and Google OAuth
- Validation: Zod
- Storage: local filesystem MVP, with future S3 support planned
- Main user roles: RUNNER, ORGANIZER, ADMIN, SUPERADMIN
- Main product journeys:
  1. Public users discover races.
  2. Runners create accounts, verify email, register for races, and manage their registrations.
  3. Organizations request approval, create races, manage participants, and invite members.
  4. Admins approve organizations and races, manage users, and review audit logs.
  5. Runners use the AI coach for goals, runs, and training plans.

## Required reading order

Read these files first when they exist:

1. `AGENTS.md`
2. `TODO.md`
3. `CODEX_CONTEXT.md`
4. `EXECUTION_PLAN.md`
5. `prisma/schema.prisma`
6. `package.json`
7. `.env.example`
8. Authentication and authorization files
9. Domain helpers and API/server-action files related to each major journey
10. QA, deployment, and AI-coach documentation

Then inspect the relevant source files, migrations, configuration, and scripts. Use repository search to find TODOs, placeholders, unsafe patterns, duplicate logic, missing authorization checks, and incomplete features.

## Audit areas

### 1. Current project status

Explain what is genuinely implemented, partially implemented, broken, or only planned.

Review at minimum:

- Public race discovery and race detail pages
- Authentication, email verification, Google OAuth, redirects, and sessions
- Runner profile and registration flows
- Organizer onboarding, organization membership, invitations, and race management
- Admin and superadmin workflows
- Notifications, email, push, uploads, and local storage
- AI coach APIs, safety rules, quotas, privacy, and UI
- Database schema, migrations, seed data, and raw SQL usage
- Deployment, environment configuration, CI, smoke checks, and e2e coverage
- i18n, RTL support, accessibility, responsive behavior, and theme modes

For every status claim, include file paths and line numbers when possible.

### 2. Gap analysis

Compare the actual codebase with:

- The product goal in `TODO.md`
- The remaining work in `EXECUTION_PLAN.md`
- Security and deployment requirements
- The expected MVP user journeys

Classify each gap as one of:

- Missing
- Partially implemented
- Implemented but fragile
- Implemented and verified
- Documentation only / not implemented

Highlight contradictions between `TODO.md`, `EXECUTION_PLAN.md`, other docs, and the code. Do not treat a checked checkbox as proof of completion.

### 3. Security audit

Perform a practical security review covering:

- Authentication weaknesses, account linking, session handling, password handling, email verification, and OAuth
- Authorization and IDOR risks across runner, organizer, admin, and superadmin routes
- Cross-user and cross-organization data access
- Middleware versus server-side authorization gaps
- Missing rate limits, brute-force protection, replay protection, and abuse controls
- Input validation, unsafe redirects, SQL injection, raw SQL parameterization, and mass assignment
- File upload validation, MIME spoofing, path traversal, stored XSS, EXIF/parser risks, and payment-proof access
- Secrets accidentally exposed to client code or logs
- PII leakage, logging, analytics, notifications, AI prompts, and retention
- CSRF, XSS, clickjacking, security headers, CORS, and cookie settings
- Race-condition risks in registration capacity, duplicate registration, invitations, and role changes
- Admin safeguards, MFA readiness, audit-log integrity, and last-superadmin protection
- Dependency vulnerabilities and unsupported/EOL runtime versions
- Production configuration, database backups, error handling, monitoring, and incident response

For each finding, provide:

- Severity: Critical, High, Medium, Low, or Informational
- Confidence: High, Medium, or Low
- Exact location: file, route/function, and line number if available
- What an attacker or failure scenario could do
- Why the current control is insufficient
- A specific remediation
- A focused test or verification step

Never claim that a vulnerability is exploitable unless the code supports that conclusion. Clearly label hypotheses that require runtime verification.

### 4. Quality and maintainability

Identify:

- TypeScript, React, Next.js, Prisma, and database design problems
- Error-handling and validation inconsistencies
- Duplicate business logic and unclear ownership of domain rules
- Raw SQL that should be replaced or isolated
- Performance issues, N+1 queries, unbounded queries, missing indexes, and pagination gaps
- Caching and revalidation problems
- Build, lint, typecheck, migration, seed, and deployment risks
- Missing automated tests for authorization, registration, capacity, payments, invitations, admin approvals, and AI safety
- Documentation that is stale, contradictory, or missing operational instructions

### 5. Product and UX improvements

Recommend improvements that are useful for ZidRun’s Algerian running audience. Consider:

- Clarity and conversion in race discovery and registration
- Organizer operational efficiency
- Admin support and moderation workflows
- Mobile-first usability and accessibility
- English, French, and Arabic copy and RTL behavior
- Trust, safety, privacy, and transparency
- Notifications and lifecycle communication
- Analytics that avoid collecting unnecessary sensitive data
- AI coach usefulness, safety boundaries, cost control, and user consent

Separate essential MVP fixes from optional growth ideas. Do not recommend payment gateways, marketplaces, bib resale, or other explicitly deferred features unless you explain why the product scope should change.

## Verification commands

Run safe, relevant checks if the environment allows them, such as:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Available smoke, unit, or e2e checks
- `npm audit` or the project’s dependency audit command
- Prisma schema/migration validation

Do not modify source files, database data, migrations, environment files, uploads, or configuration. Do not install packages. If a command cannot run, record the exact reason and continue with static analysis.

## Required final report format

Return a Markdown report with these sections:

1. Executive summary
2. Project health scorecard
   - Functionality
   - Security
   - Data integrity
   - Performance
   - Test coverage
   - Accessibility and UX
   - Deployment readiness
   - Documentation quality
3. Verified implemented capabilities
4. Missing or partial capabilities
5. Security findings, ordered by severity
6. Reliability and data-integrity findings
7. Performance and maintainability findings
8. Product and UX opportunities
9. Documentation contradictions and stale claims
10. Prioritized action plan
    - P0: production blockers
    - P1: launch-critical improvements
    - P2: valuable follow-up work
    - P3: later ideas
11. Suggested test plan
12. Suggested next sprint

For the action plan, include estimated effort (`S`, `M`, `L`, or `XL`), dependencies, affected files, and acceptance criteria. Rank work by risk reduction and user impact, not by convenience.

End with:

- The five most urgent actions
- The three highest-risk unknowns that require runtime or external verification
- A short list of claims that should be removed or corrected in the project documentation
```

