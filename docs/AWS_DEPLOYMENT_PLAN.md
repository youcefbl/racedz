# RaceDZ AWS Deployment Plan

This plan targets a low-cost first online MVP with separate staging and production environments on AWS.

Pricing is an estimate, not a quote. Use the AWS Pricing Calculator before buying anything. Numbers below assume low early traffic, one AWS region, small images, short log retention, and no reserved commitments. Actual cost depends on region, traffic, build frequency, logs, backups, WAF rules, public IPv4 charges, and data transfer.

Recommended first region: `eu-west-3` Paris for Algeria proximity. If lowest possible AWS price matters more than latency, compare with `us-east-1` in the AWS Pricing Calculator before launch.

## Senior DevOps Recommendation

Use AWS, but do not buy the full "enterprise" shape on day one.

For the first MVP, optimize for:

- One shared VPC.
- One shared public ALB for staging and production, using host-based routing.
- Separate ECS services, RDS databases, S3 buckets, secrets, and IAM roles per environment.
- No NAT Gateway at first.
- Staging stopped when not actively used.
- Single-AZ RDS until real public traffic justifies Multi-AZ.
- SSM Parameter Store for most configuration; Secrets Manager only for high-value secrets.
- CloudWatch log retention kept short.
- WAF enabled on production; staging protected with IP allowlist when possible.

This keeps separation where it matters for app/data safety while avoiding the largest avoidable fixed costs.

## Expected Traffic Profile

Current planning assumption:

- Up to `10,000` monthly users.
- Normal traffic often below `1,000` users.
- Registration opening days may create short pressure windows with `2,000-3,000` users in one day.
- Most high-pressure traffic will concentrate on public race detail pages, login/register, and race registration submit actions.

This traffic profile does not justify expensive always-on infrastructure. It does justify a planned scale-up mode around registration openings.

Recommended capacity model:

| Mode | When | ECS production desired count | DB target | Notes |
| --- | --- | ---: | --- | --- |
| Normal private beta | Most days | `1` task | Small Single-AZ RDS | Lowest cost, accepts app downtime if the one task fails. |
| Normal public MVP | After real users depend on it | `2` tasks | Small/medium Single-AZ RDS | Better app availability without moving DB to Multi-AZ yet. |
| Registration day | 30-60 min before registration opens until traffic cools | `2-4` tasks | Temporarily scale DB one size up if tests show pressure | Use scheduled scaling, not permanent overprovisioning. |
| Major launch | Paid marketing or large organizer campaign | `4+` tasks after load test | Multi-AZ or larger Single-AZ | Decide from load-test metrics, not guesswork. |

For `2,000-3,000` users/day, the base architecture should be enough if the registration flow is efficient. The dangerous case is not the daily total; it is many users submitting registration at the same minute. Load test for that exact path before a public race launch.

## Target Architecture

RaceDZ is currently a Next.js monolith with App Router pages, API routes, server actions, Auth.js, Prisma, PostgreSQL, uploads, notifications, and admin/organizer dashboards. For MVP, deploy the app as one container on ECS Fargate.

```text
Route 53
  -> stg.racedz.<domain>
  -> app.racedz.<domain>
  -> one shared Application Load Balancer
  -> ECS Fargate service: racedz-stg
  -> ECS Fargate service: racedz-prod
  -> RDS PostgreSQL: staging DB
  -> RDS PostgreSQL: production DB
  -> S3 buckets: staging uploads / production uploads
  -> SSM Parameter Store + selected Secrets Manager secrets
  -> CloudWatch Logs + Alarms
  -> AWS WAF on production ALB rules

Amplify
  -> optional previews only; do not host the same production app twice
```

### Why ECS For The App

The current app uses Next.js API routes, server actions, Auth.js, Prisma, uploads, notification delivery, and server-side role checks. ECS Fargate is the most direct production target without restructuring the app.

Amplify can be useful for branch previews or a future split frontend. For cost control, keep Amplify disabled until previews are actually needed. Running production in both Amplify SSR and ECS doubles operational surface and cost.

## Cost Reduction Strategy

Avoid these until they are justified:

- NAT Gateway. It is a common hidden fixed cost. For MVP, put ECS tasks in public subnets with public IPs but restrict inbound traffic to the ALB security group only. Keep RDS in private subnets.
- Separate ALB per environment. One ALB with host-based routing is enough for MVP.
- Multi-AZ staging database.
- Production Multi-AZ database before public launch.
- ElastiCache/Redis for rate limiting. Use WAF plus an RDS-backed limiter first.
- OpenSearch, EKS, App Mesh, RDS Proxy, GuardDuty paid tuning, cross-region replication, and AWS Backup plans before usage proves the need.
- CloudFront for uploads at day one. Add it later if image transfer or latency becomes a problem.
- Long CloudWatch log retention. Start with 7 days in staging and 14 days in production.

Buy these early because they are cheap or high value:

- AWS Budgets and cost alerts.
- Route 53 + ACM TLS.
- S3 encryption, lifecycle rules, and versioning.
- RDS automated backups and deletion protection in production.
- Basic CloudWatch alarms.
- WAF rate rules on production login/register/upload paths.

## Environment Layout

Use two logical environments:

| Environment | Domain | Purpose | Data | Runtime |
| --- | --- | --- | --- | --- |
| Staging | `stg.racedz.<domain>` | QA, demos, migration rehearsal | synthetic or sanitized data | scheduled/on-demand |
| Production | `app.racedz.<domain>` | real users | real user data | always on |

Recommended AWS account setup for the cost-sensitive MVP:

- Start with one AWS account.
- Use separate resource names, databases, buckets, secrets, IAM roles, and security groups per environment.
- Add separate AWS accounts later when traffic, team size, compliance, or billing discipline require it.

## Required App Changes Before Deployment

1. Replace local upload storage with S3-backed storage behind `src/lib/storage.ts`.
2. Add a Dockerfile for the Next.js app.
3. Add `/api/health` for ALB health checks.
4. Add production security headers in `next.config.ts`.
5. Add app-level rate limits for login and uploads.
6. Make production configuration come from environment variables, SSM, and Secrets Manager.
7. Add deployment runbook for migrations and rollback.
8. Add a CI deploy workflow for staging first, then production with manual approval.

## AWS Resources

### Network

Low-cost MVP network:

- One VPC.
- Two public subnets for ALB and ECS tasks.
- Two private subnets for RDS.
- Internet Gateway for public subnets.
- No NAT Gateway initially.
- Security groups:
  - ALB accepts `443` from internet.
  - ECS accepts app port only from the ALB security group.
  - RDS accepts `5432` only from ECS security groups.

Security note: ECS tasks may have public IPs for outbound internet without NAT. This is acceptable for the cost-sensitive MVP only if inbound access is locked to the ALB security group, app secrets are least-privilege, and no task security group allows public inbound traffic.

Upgrade path:

- Add NAT Gateway or VPC endpoints when the budget allows stronger private-network isolation.
- If using NAT later, use one NAT Gateway first, not one per AZ, until availability requirements justify the extra fixed cost.

### Compute

- ECS Fargate cluster: one cluster can host both staging and production services.
- Fargate platform: Linux/ARM64 if the Docker image and dependencies work, because Graviton is usually cheaper.
- Staging service:
  - `0.25 vCPU / 0.5 GB` or `0.25 vCPU / 1 GB`.
  - Desired count `0` when idle.
  - Desired count `1` only during QA/demo windows.
- Production private beta:
  - Start with 1 task, `0.5 vCPU / 1 GB`.
  - Accept that this is not highly available.
  - Move to 2 tasks before public launch.
- Production public MVP:
  - 2 tasks, `0.5 vCPU / 1 GB`.
  - Auto scale at CPU 60-70% and memory 70-80%.
- Registration-day boost:
  - Scheduled desired count `2-4` tasks.
  - Scale up 30-60 minutes before registration opens.
  - Scale down after 2-4 quiet hours.
  - Keep max count capped at first so a bug cannot create surprise compute cost.

### Database

- RDS PostgreSQL.
- Staging:
  - Single-AZ.
  - Small burstable Graviton instance if available in region.
  - 20 GB gp3.
  - 3-day backups.
  - Stop outside testing windows when possible. RDS can be stopped temporarily, but it will not stay stopped forever; plan for periodic automatic restart behavior.
- Production private beta:
  - Single-AZ.
  - Small burstable Graviton instance.
  - 20-50 GB gp3.
  - 7-day automated backups.
  - Deletion protection enabled.
- Production public MVP:
  - Start with a small/medium burstable Graviton instance after load testing registration submit traffic.
  - Move to Multi-AZ for availability before paid marketing, large event campaigns, or serious organizer dependency.
  - 14-30 day backups.
  - Snapshot before every production migration.

Do not use Aurora for the first MVP. Standard RDS PostgreSQL is simpler and cheaper at this stage.

Database performance rules for registration days:

- Add or verify indexes on race slug/status/date filters, registration uniqueness, user registrations, and category availability lookups.
- Keep registration creation in one short transaction.
- Enforce duplicate registration with the database unique constraint, not only app checks.
- Avoid long-running admin reports during registration openings.
- Do not send emails or push notifications inside the critical registration transaction; write notification records quickly and deliver after the registration commit.
- Cap Prisma/database connections per task so scaling ECS tasks does not exhaust RDS connections.
- Add RDS Proxy only if connection churn becomes a real measured issue; it is useful, but not free.
- Watch RDS CPU, connections, locks, and slow queries during the first real registration day.

### Upload Storage

- S3 buckets:
  - `racedz-stg-uploads`
  - `racedz-prod-uploads`
- Block public access by default.
- Use server-mediated uploads first, then presigned uploads later if app bandwidth becomes a cost/performance issue.
- Enable:
  - Server-side encryption.
  - Versioning for production.
  - Lifecycle cleanup for temporary uploads.
  - Abort incomplete multipart uploads after 1-7 days.
  - Prefixes: `avatar/`, `race/`, `organization/`, later `marketplace/`.

Cost rule: do not add CloudFront until either image delivery is slow, S3 transfer grows, or you need better caching/control for public images.

### DNS And TLS

- One Route 53 hosted zone for the domain.
- ACM certificates:
  - `stg.racedz.<domain>`
  - `app.racedz.<domain>`
  - optional `www.racedz.<domain>`
- ALB HTTPS listener.
- HTTP to HTTPS redirect.
- Host-based routing:
  - `stg.racedz.<domain>` -> staging target group.
  - `app.racedz.<domain>` -> production target group.

### Secrets And Config

Use SSM Parameter Store standard parameters for normal configuration:

- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_TAGLINE`
- `AWS_REGION`
- bucket names
- feature flags

Use Secrets Manager only for high-value secrets:

- `DATABASE_URL`
- `AUTH_SECRET`
- `RESEND_API_KEY`
- Firebase private key and service account email.
- Future payment gateway keys.

Cost rule: Secrets Manager is worth it for real secrets, but do not store every harmless config value there.

### CI/CD

Use GitHub Actions first. Avoid CodePipeline/CodeBuild until AWS-native deployment is worth the extra setup.

Staging pipeline:

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run build`
5. Docker build
6. Push image to ECR
7. Run `prisma migrate deploy`
8. Deploy ECS service
9. Run smoke checks against `https://stg.racedz.<domain>`

Production pipeline:

1. Deploy only from a tag or protected production branch.
2. Require manual approval.
3. Take an RDS snapshot.
4. Run `prisma migrate deploy`.
5. Deploy ECS rolling update.
6. Run smoke checks.
7. Keep previous task definition ready for rollback.

## Estimated Monthly AWS Cost

Assumptions:

- Low MVP traffic.
- No heavy video/media.
- Uploads are mostly optimized images.
- No NAT Gateway.
- One shared ALB.
- Staging is not running 24/7.
- Logs retained 7 days in staging and 14 days in production.
- No reserved instances, savings plans, or free-tier assumptions.
- Prices vary by region.

### Cheapest Practical MVP Shape

| Area | Decision | Cost impact |
| --- | --- | --- |
| ALB | One shared ALB for staging and production | Avoids duplicate fixed ALB cost. |
| Staging ECS | Desired count `0` when idle | Pays compute only when used. |
| Staging RDS | Stop outside QA windows | Reduces DB instance-hour cost, while storage still costs. |
| Production ECS | 1 task for private beta | Cheaper but no app-level high availability. |
| Production DB | Single-AZ RDS | Cheaper but has failover downtime risk. |
| Registration spikes | Scheduled scale-up only around race openings | Handles pressure without paying for peak all month. |
| NAT | No NAT Gateway | Avoids one of the largest fixed costs. |
| WAF | Production only at first | Keeps staging cheap. |
| Secrets | SSM for config, Secrets Manager for real secrets only | Avoids per-secret sprawl. |

### Staging Estimate

| Service | Monthly estimate | Cost-minimized notes |
| --- | ---: | --- |
| Route 53 hosted zone/query share | `$1-3` | One hosted zone shared by both environments. |
| ECS Fargate | `$0-8` | Desired count `0` when idle; run only for QA/demo. |
| Shared ALB share | `$0-10` | If production already pays for the ALB, staging adds mostly target/rule usage. |
| RDS PostgreSQL Single-AZ | `$5-25` | Stop when idle; storage and backups remain. |
| S3 uploads | `$1-3` | Small image volume. |
| SSM / Secrets Manager | `$0-3` | Prefer SSM for non-secret config. |
| CloudWatch logs/alarms | `$1-5` | 7-day retention. |
| AWS WAF | `$0-5` | Prefer IP allowlist/basic ALB rules for staging. |
| Amplify previews | `$0` | Keep off until needed. |
| **Total** | **`$8-60/mo`** | Assumes staging is not always on. |

If staging must run 24/7 with its own database and WAF, expect roughly `$35-110/mo`.

### Production Private Beta Estimate

| Service | Monthly estimate | Cost-minimized notes |
| --- | ---: | --- |
| Route 53 hosted zone/queries | `$1-5` | Domain registration is annual and varies by TLD. |
| ECS Fargate | `$10-35` | 1 small task, preferably ARM64. |
| ALB | `$18-35` | Fixed hourly ALB cost plus low LCU usage and public IPv4. |
| RDS PostgreSQL Single-AZ | `$25-70` | Small burstable DB, 20-50 GB gp3, 7-day backups. |
| S3 uploads | `$2-15` | Depends on image count and transfer. |
| CloudWatch logs/alarms | `$3-15` | 14-day retention, low log volume. |
| SSM / Secrets Manager | `$1-8` | Keep secret count small. |
| AWS WAF | `$8-25` | One Web ACL plus focused rate rules. |
| Amplify | `$0` | Off unless previews are needed. |
| **Total** | **`$68-208/mo`** | Cheapest credible AWS production shape. |

Registration-day scale-up usually adds only a small extra monthly amount if it runs for a few hours per event. Budget an additional `$2-20/mo` early, depending on how many registration windows you run and whether the database is temporarily scaled.

### Production Public MVP Estimate

| Service | Monthly estimate | Notes |
| --- | ---: | --- |
| Route 53 hosted zone/queries | `$1-8` | More traffic means more DNS queries, usually still small. |
| ECS Fargate | `$25-70` | 2 small tasks for app availability. |
| ALB | `$20-45` | Depends on LCUs and public IPv4. |
| RDS PostgreSQL Single-AZ | `$35-90` | Cost-sensitive launch. |
| RDS PostgreSQL Multi-AZ | `$90-220+` | Recommended before serious public campaigns. |
| S3 uploads | `$5-40` | Depends on image volume and transfer. |
| CloudWatch logs/alarms | `$5-25` | Watch log volume carefully. |
| SSM / Secrets Manager | `$2-12` | Depends on number of secrets. |
| AWS WAF | `$10-35` | Add managed rules only when justified. |
| Amplify previews/builds | `$0-15` | Optional preview environments. |
| **Total Single-AZ** | **`$103-340/mo`** | Lower cost, less DB availability. |
| **Total Multi-AZ** | **`$160-470+/mo`** | Better DB availability. |

For the stated traffic profile, start with the Single-AZ public MVP shape plus registration-day scheduled scaling. Multi-AZ is an availability decision, not a traffic-volume requirement at `10,000` monthly users.

### Hard Cost Warnings

- NAT Gateway can add a meaningful fixed monthly cost. Avoid it for MVP or use only one NAT Gateway if required.
- ALB is mostly fixed cost. Sharing one ALB between staging and production matters.
- RDS Multi-AZ roughly doubles database infrastructure cost. Use it when downtime risk costs more than the bill.
- CloudWatch can become expensive if the app logs full request bodies, noisy debug logs, or repeated provider errors.
- Public IPv4 addresses are no longer something to ignore; check the VPC/public IPv4 pricing in the calculator.

### Pricing References

- AWS Fargate: vCPU, memory, duration, ephemeral storage, ARM/x86, and Spot pricing.
- Application Load Balancer: load balancer hours, LCU usage, data transfer, and public IPv4 charges.
- RDS PostgreSQL: instance-hours, storage, backups, Single-AZ, and Multi-AZ.
- S3: storage, requests, retrieval, transfer, lifecycle, and replication.
- Route 53: hosted zones, DNS queries, and annual domain registration.
- AWS WAF: Web ACL, rule, request, and managed-rule charges.
- Secrets Manager: per secret and API calls.
- CloudWatch: logs, metrics, alarms, and ingestion.
- Amplify Hosting: build minutes, CDN storage, transfer, SSR request/duration.

## Deployment Steps

### Phase 1: Cost-Control Foundation

1. Create AWS Budget alerts:
   - Staging warning: `$30`, critical: `$60`.
   - Production private beta warning: `$100`, critical: `$200`.
   - Combined account warning: choose a monthly hard expectation and alert at 50%, 80%, and 100%.
2. Apply mandatory tags:
   - `Project=RaceDZ`
   - `Environment=stg|prod`
   - `Owner=Youcef`
   - `CostCenter=racedz`
3. Create one VPC with public/private subnets.
4. Create one ALB with HTTPS.
5. Create separate target groups for staging and production.
6. Create S3 buckets for staging and production uploads.
7. Create RDS staging and production databases.
8. Create ECR repository.
9. Create ECS cluster and task execution roles.
10. Create CloudWatch log groups with explicit retention.

### Phase 2: App Production Readiness

1. Add Dockerfile.
2. Add S3 storage implementation behind `src/lib/storage.ts`.
3. Add `/api/health`.
4. Add security headers.
5. Add rate limiting.
6. Add stricter upload validation.
7. Add production env examples:
   - `AUTH_SECRET`
   - `AUTH_URL`
   - `NEXTAUTH_URL`
   - `DATABASE_URL`
   - `UPLOAD_PROVIDER=s3`
   - `S3_BUCKET_NAME`
   - `AWS_REGION`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - Firebase server and web config.
8. Make `prisma migrate deploy` part of deployment.

### Phase 3: Staging

1. Deploy staging with ECS desired count `1`.
2. Seed staging data.
3. Run:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run build`
   - `npm run smoke` against staging URL.
4. Run `docs/QA_CHECKLIST.md` manually.
5. Validate:
   - Auth redirects.
   - Email verification.
   - Race registration.
   - Organizer race creation.
   - Admin approval.
   - Uploads to S3.
   - Notifications and emails.
   - Push token registration.
6. After QA, set staging ECS desired count to `0`.
7. Stop staging RDS when no QA is planned.

### Phase 4: Production Private Beta

1. Create production RDS from clean migrations, not staging seed.
2. Configure production secrets.
3. Deploy production ECS service with 1 task.
4. Enable backup and core alarms.
5. Enable WAF rate rules for login/register/uploads.
6. Run smoke checks.
7. Invite limited users.
8. Monitor logs, RDS metrics, and costs daily for the first week.

### Phase 4.5: Registration-Day Readiness

1. Load test the public race detail, login, register, and race registration submit paths.
2. Test at least:
   - 100 concurrent browsers/users.
   - 300 registration submissions over 10-15 minutes.
   - A spike test where many users click submit in the same 60 seconds.
   - Duplicate-submit behavior for the same user/category.
3. Confirm registration capacity cannot go negative.
4. Confirm emails/push notifications do not block successful registration.
5. Schedule ECS scale-up before each important registration opening.
6. Create a short operational checklist:
   - Open CloudWatch dashboard.
   - Confirm ECS desired count.
   - Confirm RDS CPU/connections.
   - Confirm WAF is not blocking real users.
   - Confirm Resend/Firebase failures do not break registration.
7. Scale down after traffic cools.

### Phase 5: Public MVP

1. Increase production ECS desired count to 2.
2. Use registration-day scheduled scaling for known spikes.
3. Move production RDS to Multi-AZ when public campaigns or organizer dependency justify it.
4. Tune WAF rules.
5. Add restore drill.
6. Add incident checklist.
7. Add uptime monitor.
8. Add support/contact workflow.
9. Confirm legal pages and privacy policy.

## Security Plan

### Rate Limiting

Protect:

- `POST /login` / Auth.js credentials flow.
- `POST /register`.
- `POST /api/uploads`.
- Race registration actions.
- Organizer invite actions.
- Announcement creation.

Cost-controlled implementation:

1. AWS WAF rate-based rules on production:
   - Global IP rate rule.
   - Narrower rules for `/login`, `/register`, and `/api/uploads`.
   - Start with block after threshold; add CAPTCHA/challenge only if needed.
2. App-level fixed-window limits:
   - Store counters in PostgreSQL first.
   - Key by route + IP + authenticated user id when available.
   - Return `429` with a generic message.
   - Add cleanup job or TTL-like delete query for old windows.

Do not add Redis/ElastiCache only for rate limiting during MVP. Add it later if PostgreSQL counters become measurable load.

Recommended initial thresholds:

- Login: strict per IP and per email.
- Register: strict per IP.
- Upload: per user and per IP.
- Announcement/invite: per organization and per actor.

### Security Headers

Add headers in `next.config.ts`:

- `Strict-Transport-Security` for production HTTPS.
- `X-Content-Type-Options: nosniff`.
- `X-Frame-Options: DENY` or CSP `frame-ancestors 'none'`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` disabling unused browser features.
- Content Security Policy:
  - Start report-only in staging.
  - Enforce in production after fixing violations.
  - Allow only required sources: app domain, S3/CloudFront image domain if used, Firebase, Resend-independent email links, and fonts if used.

### Upload Validation

Current local upload validation must be hardened before production.

Required:

- Move from local filesystem to S3.
- Keep max size at 5 MB initially.
- Validate MIME type and file extension.
- Validate file signature/magic bytes, not only browser-provided MIME.
- Generate UUID object keys.
- Strip user-provided filenames from storage paths.
- Store uploads under scoped prefixes.
- Only allow:
  - JPEG
  - PNG
  - WebP
  - GIF only if truly needed.
- Reject SVG for user uploads unless sanitized.
- Set safe response headers for served objects.
- Strip EXIF metadata if privacy becomes a concern.

Low-cost S3 pattern:

- MVP: upload through the RaceDZ API, validate, then stream to S3.
- Later: presigned POST with server-created policy:
  - fixed content length range
  - fixed content type allowlist
  - scoped key prefix
  - short expiry

Do not add paid antivirus scanning on day one unless uploads expand beyond images or risk changes. Revisit scanning before marketplace documents, PDFs, or arbitrary attachments.

### Production Secrets

Rules:

- No production secrets in Git.
- No production secrets in `.env` on laptops unless absolutely required.
- ECS task role reads only the parameters/secrets it needs.
- Rotate `AUTH_SECRET` only with a session invalidation plan.
- Rotate database password quarterly or after suspected exposure.
- Restrict IAM by least privilege.

Suggested storage:

- SSM Parameter Store:
  - public app config
  - bucket names
  - non-secret feature flags
- Secrets Manager:
  - database URL/password
  - Auth secret
  - Resend API key
  - Firebase private key
  - future payment keys

### Backup Strategy

RDS:

- Automated backups:
  - Staging: 3 days.
  - Production private beta: 7 days.
  - Public MVP: 14-30 days.
- Enable deletion protection in production.
- Snapshot before every production migration.
- Test restore monthly after public MVP; before that, test restore once before launch.
- Store migration logs with deployment metadata.

S3:

- Enable default encryption.
- Enable versioning on production uploads.
- Lifecycle:
  - Abort incomplete multipart uploads after 1-7 days.
  - Move old noncurrent versions to cheaper storage after 30-90 days.
  - Expire temporary uploads.
- Do not enable cross-region replication for MVP unless there is a real recovery requirement.

Application:

- Keep Docker image tags immutable.
- Keep last known-good ECS task definition.
- Rollback by redeploying previous task definition if database migration is compatible.
- For destructive migrations, create a manual rollback note before deploy.

### Monitoring And Alerts

Minimum CloudWatch alarms:

- ECS service unhealthy task count.
- ALB 5xx count.
- ALB target response time.
- RDS CPU.
- RDS free storage low.
- RDS database connections high.
- RDS backup failures.
- High login failures if tracked.
- Upload rejection spike if tracked.
- AWS billing budget threshold.

Logs:

- ECS app logs:
  - staging: 7 days
  - production: 14 days initially
- ALB access logs:
  - off for private beta unless troubleshooting.
  - on to S3 for public MVP if security/traffic analysis is needed.
- WAF logs:
  - sample/metrics first.
  - full logs only when debugging abuse.

Application telemetry:

- Add structured logs for:
  - auth failure count, without logging passwords.
  - upload reject reason.
  - notification provider failure.
  - admin approval/rejection actions.
  - payment/manual review actions later.

## Release Checklist

Before staging deploy:

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run smoke`
- [ ] `npx prisma migrate status`
- [ ] S3 upload path tested.
- [ ] Resend verified domain configured.
- [ ] Firebase push config tested.
- [ ] AWS Budget alerts configured.
- [ ] CloudWatch log retention set explicitly.

Before production deploy:

- [ ] Staging QA checklist completed.
- [ ] Production secrets configured.
- [ ] RDS snapshot taken.
- [ ] Migrations reviewed.
- [ ] WAF enabled for production.
- [ ] Backups enabled.
- [ ] Alarms enabled.
- [ ] Smoke check against production passes.
- [ ] Rollback task definition identified.
- [ ] Expected monthly cost reviewed in AWS Pricing Calculator.

## Open Decisions

- Use one AWS account for the first MVP, or create separate staging/production accounts now?
- Production database starts Single-AZ for private beta or Multi-AZ from day one?
- Keep staging stopped by default, or leave it always on for demos?
- Use ARM64 Fargate from day one, or start x86 for simpler dependency compatibility?
- Serve public images through app/S3 first, or add CloudFront at launch?
- Start with RDS-backed rate limits, or add Redis only if abuse appears?
