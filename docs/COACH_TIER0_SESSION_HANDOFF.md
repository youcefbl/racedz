# Coach Tier 0 Review — Session Handoff

> Point-in-time context snapshot for continuing this session on another device.
> This is not a progress tracker, roadmap, backlog, or release authority. Use
> `EXECUTION_PLAN.md` as the only source of truth for project status, priorities,
> gates, blockers, and evidence.

## Snapshot

- Date: 2026-08-02
- Repository: `/home/ymsi/work/racedz`
- Branch: `feat/coach-tier0`
- Reviewed commit: `a18e9b9db1f8921c6e2a5f21710dc4f65d8c13be`
  (`feat(coach): Tier 0 governance fixes — safety preflight, auditable consent, memory suppression, config truth`)
- Comparison base: `main` at `abee6f16e64f672cd38ea87f57e01bcf2062474a`
- Review verdict: **Changes requested.** No release or security gate was closed, and the
  release-plan status remained unchanged.

## What this session did

1. Reviewed Fable's Coach assessment and produced a combined Codex/Fable review.
2. Reviewed the committed implementation on `feat/coach-tier0` rather than using a
   review document as a progress tracker.
3. Added the implementation findings and verification evidence to
   `coach_review_fable_codex.md` §9.
4. Updated the evidence row and date in `EXECUTION_PLAN.md`; it remains the only
   authoritative status tracker.
5. Did not implement application fixes or modify the concurrent uncommitted Coach work.

Relevant review documents at the repository root:

- `coach_review_fable.md` — Fable review input.
- `coach_review_codex.md` — Codex review input.
- `coach_review_codex_fable.md` — earlier unified review output.
- `coach_review_fable_codex.md` — combined assessment; §9 contains the review of
  committed Tier 0 code at `a18e9b9`.

## Findings recorded against `a18e9b9`

| ID | Severity | Finding |
|---|---|---|
| `T0-R01` | P1 | Native goal create/edit does not transmit the consent flag, so health answers can be stored without the intended native consent grant. |
| `T0-R02` | P1 | Consent is optional and persisted after health fields in a non-atomic, fail-open step whose errors are swallowed. |
| `T0-R03` | P1 | TTS still accepts arbitrary text and lacks Coach usage budgets/accounting; its generated audio is stored in a public immutable cache. |
| `T0-R04` | P2 | Active-consent lookup does not require the current consent-policy version. |
| `T0-R05` | P2 | Memory dismissal suppression lacks a database/concurrency invariant, and delete-all removes suppression tombstones. |
| `T0-R06` | P2 | Unknown-cost reporting mixes failed requests with genuinely unpriced successful requests, while the primary admin UI omits the partial-cost warning. |
| `T0-R07` | P2 | The new governance boundaries lack database, API, native-contract, and route/service integration coverage. |

The detailed evidence, impact, file references, and recommended corrections are in
`coach_review_fable_codex.md` §9. Do not close these findings solely because matching
code appears in a dirty worktree; re-review a stable commit and collect evidence first.

## Verification completed during the review

The repository's `tsx` wrapper could not open its IPC socket in the sandbox. The same
TypeScript scripts were run successfully with `node --import tsx`:

- Coach safety/domain suite passed, including 18 urgent and 9 benign safety cases.
- Coach context suite passed.
- Adaptive planner suite passed: 68/68 checks.
- Coach memory pure suite passed: 42/42 checks.
- Workout-structure suite passed.
- Web English/French/Arabic parity passed: 629 UI keys and 461 Coach keys.
- Native i18n parity passed: 472 keys.
- Targeted ESLint over the committed Tier 0 files passed.

Not established in this session:

- Full repository typecheck/build acceptance. The available worktree/environment had
  unrelated or pre-existing dependency/Sentry failures plus a contemporaneous WIP error.
- Database migration or integration behavior.
- Browser, Android emulator/device, TalkBack, performance, or production behavior.
- Live OpenAI or TTS provider behavior and cost accounting.
- Approval of broader multilingual safety taxonomy/escalation copy.

The repository-required ZidRun app-review skill was used for the review. The additional
`impeccable` skill named by repository guidance was not available in the session.

## Worktree boundary at handoff

At the time this handoff was written, these review-document changes were uncommitted:

- `EXECUTION_PLAN.md`
- `coach_review_fable_codex.md`
- `docs/COACH_TIER0_SESSION_HANDOFF.md` (this file)

The worktree also contained concurrent, uncommitted Coach implementation work. Treat it
as preserved WIP that was **not** part of the committed-code verdict and was **not**
authored or accepted by the review documentation work:

- Native consent contract/onboarding changes under `native-android/.../Dtos.kt` and
  `native-android/.../CoachOnboardingScreen.kt`.
- Prisma schema changes and two new migration directories:
  `20260802130000_coach_interaction_idempotency` and
  `20260802140000_coach_memory_performance_kind`.
- Coach goal/TTS API, admin UI, dashboard/conversation/runs UI, copy, and shared types.
- Coach admin, consent, context, memory, OpenAI, reporting, schema, service, and TTS
  library changes under `src/lib`.

Run `git status --short` before doing anything. Do not reset, discard, overwrite, or
silently include these application changes in a documentation-only commit. Their exact
state may have changed after this snapshot.

## Moving this context to another device

Markdown files and uncommitted implementation changes do not travel through Git by
themselves. Before switching devices, intentionally preserve the desired state:

1. Review `git diff` and `git status --short` to separate the review documents from the
   concurrent application WIP.
2. Commit and push the review documents, including this handoff, if they should be shared.
3. Preserve the application WIP separately by committing it to an appropriate branch or
   exporting a patch/stash in a way that is intentionally transferred. A local-only stash
   will not appear on another device.
4. On the other device, fetch and check out `feat/coach-tier0`, then confirm the actual
   HEAD and worktree state. Do not assume `a18e9b9` is still the branch tip.

No commit or push was performed automatically in this session.

## Resume procedure

On the next device/session:

1. Read `AGENTS.md` and `EXECUTION_PLAN.md` first.
2. Read `PRODUCT.md`, `docs/COACH_CONTEXT_DATA_CONTRACT.md`, and the complete
   `.agents/skills/zidrun-app-review/SKILL.md` before reviewing Coach app work.
3. Read this handoff and `coach_review_fable_codex.md` §9.
4. Inspect the current branch, HEAD, log, status, and diff. Preserve any dirty work.
5. Identify a stable commit containing the intended fixes, then re-test `T0-R01` through
   `T0-R07` against that commit.
6. Run the focused Coach, memory, planner, workout, i18n, lint, integration, and relevant
   native checks. Add browser/device/provider evidence where applicable.
7. Update `EXECUTION_PLAN.md` only when new evidence actually changes an affected gate,
   blocker, or status. Keep review documents as supporting evidence, not trackers.

## Decisions still requiring explicit product/owner direction

These are review dependencies, not a new backlog:

- Consent policy versioning, withdrawal behavior, legal wording, and retention rules.
- Whether “delete all memories” must preserve suppression so deleted facts cannot be
  immediately re-learned.
- Approved multilingual safety escalation wording and the broader free-text taxonomy.

## Ready-to-paste continuation prompt

```text
Read AGENTS.md, EXECUTION_PLAN.md, docs/COACH_TIER0_SESSION_HANDOFF.md, and coach_review_fable_codex.md §9. Continue reviewing feat/coach-tier0 from the current stable HEAD. Preserve all existing dirty work. Verify T0-R01 through T0-R07 against a committed implementation, run the focused and integration checks, and update EXECUTION_PLAN.md only with evidence that changes a gate or blocker.
```
