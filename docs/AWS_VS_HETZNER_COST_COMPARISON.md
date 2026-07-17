# ZidRun: AWS vs Hetzner at approximately $80–90/month

This document compares two realistic first-production setups for ZidRun. Prices are planning estimates as of July 2026, excluding VAT, domain registration, email delivery, payment-provider fees, and unusually high traffic. Provider prices can change; verify the final configuration in the AWS Pricing Calculator and Hetzner Cloud console before purchase.

## Short recommendation

Choose **AWS** if the priority is managed operations and automatic scaling during race-registration spikes.

Choose **Hetzner** if the priority is maximum CPU/RAM and the lowest predictable monthly bill, and you are comfortable managing the server, PostgreSQL, backups, deployments, monitoring, and failover yourself.

For ZidRun, AWS is the better fit if the one on-demand task plus temporary Fargate Spot tasks stays within budget. Hetzner gives more raw resources for the same money, but it does not provide AWS-level managed autoscaling or managed PostgreSQL reliability.

## Option 1: AWS — managed and automatically scalable

### Base architecture

```text
CloudFront (optional)
        |
Application Load Balancer
        |
ECS Fargate service
  - 1 x On-Demand task always running
  - Fargate Spot tasks added during spikes
        |
RDS PostgreSQL Single-AZ
        |
S3 for uploads
```

Recommended first configuration:

- Region: Europe/Milan, matching the current estimate.
- ECS task: Linux, `0.5 vCPU / 2 GB RAM`.
- Minimum tasks: `1` On-Demand task.
- Autoscaling: add Spot tasks when CPU, memory, or ALB requests per target increase.
- RDS: PostgreSQL Single-AZ, 40 GB gp2/gp3, on-demand initially.
- No NAT Gateway initially; use public task IPs with strict security groups to avoid the fixed NAT charge.
- S3 for uploads. CloudFront can be added later or used for the frontend/static assets.

### Monthly estimate

| AWS component | Estimate | Notes |
| --- | ---: | --- |
| Application Load Balancer | `$25.47` | ALB hourly charge plus estimated LCU usage from the current calculator. |
| Fargate: 1 x `0.5 vCPU / 2 GB` | `$25.13` | One task running continuously; matches the current screenshot estimate. |
| RDS PostgreSQL Single-AZ, on-demand | `$31.60` | The screenshot estimate includes the database instance and 40 GB storage. |
| **Calculator subtotal** | **`$82.20`** | Before smaller supporting charges. |
| Public IPv4, Route 53, logs, ECR, S3 | `~$5–15` | Depends on the number of task IPs, log volume, storage, and traffic. |
| CloudFront | `~$0` at low traffic | The free allowance/flat-rate option may cover an early MVP; verify the selected plan. |
| NAT Gateway | `$0` in this design | A NAT Gateway would add roughly `$33/month` before data processing, so it is intentionally omitted. |
| **Expected normal total** | **`~$90–105/month`** | One on-demand task, no NAT, low-to-moderate traffic. |

The current calculator subtotal is therefore close to `$80–90`, but the real AWS invoice will usually be somewhat higher after public IPv4, logs, storage, and other small services.

### Scaling model

Keep one On-Demand task running at all times. Configure ECS Service Auto Scaling to launch Fargate Spot tasks during demand spikes:

- Normal traffic: `1` On-Demand task.
- Registration opening: scale to `2–4` total tasks.
- Burst capacity: prefer Spot tasks for additional capacity.
- Critical registration traffic: keep at least one On-Demand task; do not depend on Spot alone.
- Known race opening: schedule the scale-up 30–60 minutes before registrations open.
- Set a maximum task count so an application problem cannot create an unexpected bill.

Fargate Spot can be interrupted when AWS needs the capacity. The application must handle task termination gracefully, and registration requests must be safe to retry. ECS can replace an interrupted task, but Spot capacity is not guaranteed.

Changing from `0.5 vCPU / 2 GB` to a larger task is a new deployment/task definition. It is not the same as horizontal autoscaling and should be used only when each task needs more memory or CPU.

### AWS advantages

- Managed RDS backups, patching, monitoring, and storage growth.
- Automatic horizontal scaling for traffic spikes.
- ALB health checks remove unhealthy tasks from rotation.
- Easy path to Multi-AZ RDS, more tasks, WAF, CloudFront, and private networking.
- One On-Demand task provides a stable baseline while Spot reduces burst compute cost.

### AWS limitations and risks

- The ALB has a fixed monthly cost even when traffic is low.
- RDS Single-AZ is not highly available; it is a cost-saving MVP choice.
- Public task IPs avoid NAT but are still billable and require careful security groups.
- A real high-availability setup with Multi-AZ RDS, NAT, more tasks, and stronger observability will cost more than `$90/month`.
- The current ZidRun local upload storage must move to S3 before running multiple tasks; otherwise files written to one task will not exist on another task.

Useful AWS documentation: [ECS service autoscaling](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-autoscaling-targettracking.html), [Fargate capacity providers and Spot](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-capacity-providers.html), [ECS outbound networking](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/networking-outbound.html), and [CloudFront pricing](https://aws.amazon.com/cloudfront/pricing/).

## Option 2: Hetzner — more resources for a predictable bill

### Recommended architecture around $80–90

```text
Hetzner Load Balancer (optional)
        |
CPX22 application server
  - Docker Compose or Docker Swarm
  - Next.js app + Caddy
        |
Private Hetzner Network
        |
CCX13 PostgreSQL server
  - PostgreSQL managed by us
        |
Hetzner Object Storage for uploads/backups
```

Approximate current server prices used for planning:

- `CPX22`: 2 vCPU / 4 GB RAM, approximately `$22.99/month`.
- `CCX13`: 2 dedicated vCPU / 8 GB RAM, approximately `$50.49/month` for new orders after the June 2026 price adjustment.
- `CCX23`: 4 dedicated vCPU / 16 GB RAM, approximately `$101.49/month`; this is outside the `$80–90` target before storage and backups.
- `CAX41`: 8 vCPU / 16 GB RAM, approximately `$48.49/month`, but it is ARM64 and is not a dedicated-CPU CCX server. Use it only after verifying the application image and native dependencies on ARM64.
- Private Hetzner Networks: no additional charge for normal internal traffic.
- Optional `LB11`: approximately `$7–8/month`; verify the current console price.
- Object Storage and backups: budget approximately `$6–13/month`, depending on stored data and backup policy.

### Monthly estimate

| Hetzner component | Estimate | Notes |
| --- | ---: | --- |
| CPX22 application server | `$22.99` | Shared/burstable CPU; 4 GB RAM. |
| CCX13 PostgreSQL server | `$50.49` | Dedicated CPU; 8 GB RAM. PostgreSQL is self-managed. |
| Private network | `$0` | App-to-database traffic stays private. |
| Object Storage and off-site backups | `~$6–13` | Verify current storage and egress pricing. |
| **Without load balancer** | **`~$79–86/month`** | Good cost/resource balance, but one app server is a SPOF. |
| Optional Load Balancer | `~$7–8` | Adds a managed entry point, but does not create a second app server. |
| **With load balancer** | **`~$87–94/month`** | Still requires a second app server for meaningful app failover. |

This setup provides substantially more RAM and dedicated database CPU than the AWS calculator subtotal, but the operational responsibility is transferred to us.

### Scaling model

Hetzner Cloud does not provide the same automatic, request-driven task scaling as ECS Fargate. Scaling normally means one of the following:

- Resize the application server vertically.
- Create a second application server and put both behind the Load Balancer.
- Add a deployment/orchestration layer and monitoring rules.
- Manually or programmatically scale before a known registration opening.

A second CPX22 app server would add approximately `$23/month`, before any additional storage or operational tooling. A resilient two-app-server design is therefore more realistically above `$100/month` once backups and the load balancer are included.

### Hetzner advantages

- Much more CPU/RAM per dollar.
- Predictable monthly pricing and no per-task billing model.
- Private networking is inexpensive.
- Suitable for a stable monolith with moderate traffic.
- Full control over Docker, PostgreSQL tuning, caching, workers, and deployment.

### Hetzner limitations and risks

- PostgreSQL patching, backups, restore testing, monitoring, and failover are our responsibility.
- One application server and one database server are still single points of failure.
- Automatic scaling requires additional engineering and is not as seamless as ECS service autoscaling.
- A server failure can cause downtime while a replacement or restore is performed.
- The current local upload volume must be moved to Hetzner Object Storage before adding multiple app servers.
- Running cron or scheduled jobs on multiple servers can duplicate work unless one worker/leader is selected.

Useful Hetzner documentation: [Cloud Load Balancers](https://docs.hetzner.com/networking/load-balancers/overview/), [Networks](https://docs.hetzner.com/cloud/networks/overview/), [Object Storage](https://docs.hetzner.com/storage/object-storage/overview/), and the [June 2026 price list](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/).

## Direct comparison

| Concern | AWS around `$80–90` | Hetzner around `$80–90` |
| --- | --- | --- |
| Raw CPU/RAM | Lower | Higher |
| Always-on baseline | 1 Fargate task | 1 app server + 1 DB server |
| Traffic autoscaling | Native ECS autoscaling | Additional engineering required |
| Database operations | RDS managed | PostgreSQL self-managed |
| App failover | A second task can be added automatically, budget permitting | Requires a second app server and load balancer |
| Database failover | Not with Single-AZ RDS | Not with one database server |
| Uploads for multiple instances | S3 | Object Storage |
| Predictability of bill | More variable | More predictable |
| Operational effort | Lower | Higher |
| Best use | Spiky traffic and less server administration | Cost-sensitive steady traffic and hands-on operations |

## Important ZidRun preparation work for either option

Before enabling multiple app instances or scaling around a registration opening:

1. Move `public/uploads` from local disk to S3-compatible object storage.
2. Ensure registration capacity and duplicate protection are enforced in one short database transaction.
3. Limit Prisma connections per application instance so scaling does not exhaust PostgreSQL.
4. Run cron/scheduled jobs only once, not once per app instance.
5. Add health checks, structured logs, error monitoring, and alerts.
6. Add rate limiting for login, registration, and uploads.
7. Test simultaneous registration submissions with the existing registration load-test workflow.
8. Keep database backups off the application server and perform a restore test.

## Final decision

**Hetzner**, on a single consolidated server, with the remaining budget spent on backups and monitoring rather than on additional infrastructure.

The generic comparison above treats managed autoscaling as the deciding advantage. For ZidRun it is not, for four reasons:

1. **Autoscaling does not arrive in time for the actual traffic shape.** A registration opening is not a gradual CPU ramp; it is a few thousand submissions within seconds. ECS target tracking must observe a metric breach, start a cold task, and pass ALB health checks before that task serves traffic — typically a minute or more after the spike has already peaked. The mitigation is to schedule the scale-up in advance (see the scaling model above), which is a capacity decision that can equally be made on a fixed server.
2. **The bottleneck is transactional, not compute.** Registration capacity and duplicate protection resolve in one short database transaction (preparation item 2). Additional application instances increase concurrent contention on the same rows and consume more PostgreSQL connections (preparation item 3). Horizontal scaling does not relieve this constraint and can worsen it.
3. **Fargate Spot is the wrong capacity class for registration burst.** Spot tasks can be interrupted, which places the most business-critical minutes on preemptible capacity. Serving burst from On-Demand tasks instead removes most of the cost advantage that motivates the AWS design.
4. **"Lower operational effort" does not hold for a single operator.** RDS removes patching and restore mechanics, but adds IAM, VPC, security groups, task definitions, CloudWatch, and ECR to the critical path. This is different operational work, not less of it, and ZidRun already runs a known Docker Compose + Caddy + Cloudflare stack in production. Migrating incurs real cost and resolves none of the constraints above.

### Recommended configuration

Prefer one `CCX13` dedicated-CPU server (`2 dedicated vCPU / 8 GB`, approximately `$50.49/month` for new orders) running both the application and PostgreSQL, over the CPX22 + CCX13 split described in Option 2. This is the realistic x86 dedicated-CPU choice within the `$80–90` budget. A `CCX23` with `4 dedicated vCPU / 16 GB` is approximately `$101.49/month` before backups and is outside this budget.

If ARM64 compatibility is verified in CI and production load testing, a `CAX41` (`8 vCPU / 16 GB`) is approximately `$48.49/month` and offers more raw resources. It is not a dedicated-CPU CCX server, so the image, Prisma engine, `sharp`, and all other native dependencies must be tested on ARM64 first.

Note that this is not a migration. `docker-compose.prod.yml` already runs PostgreSQL, the application, `cron`, and Caddy as four services on a single host, communicating over the same-host Docker network. Consolidation is the current topology; the decision here is only how large that host should be. The two-server split in Option 2 would be a change *away* from the working setup, and it costs approximately `$73.48/month` before storage and backups, doubles the number of hosts to patch, and still does not provide database failover — the database remains single-instance in either design.

Resulting monthly estimate:

| Component | Estimate |
| --- | ---: |
| `CCX13` running app + PostgreSQL + cron + Caddy | `$50.49` |
| Object Storage and off-site backups | `~$6–13` |
| **Total** | **`~$57–63/month`** |

This lands roughly `$25–30` under the `$80–90` target, which is the point: the headroom is the budget for backups, monitoring, and a larger host later, rather than an ALB and a managed control plane today.

Allocate that headroom to:

- S3-compatible Object Storage for `public/uploads` (preparation item 1). This remains genuinely outstanding — uploads currently live on the local `racedz_uploads` Docker volume, written by the app and served read-only by Caddy.
- Off-site backups with a **tested restore** (preparation item 8).
- Error monitoring and alerting (preparation item 5).

Do not add the optional Load Balancer at this stage. It introduces a managed entry point without a second application server, so it adds cost without adding failover.

Staying single-host also keeps preparation item 4 satisfied for free: the `cron` service is one container issuing authenticated requests to the app over the Docker network, so scheduled jobs already run exactly once. Adding a second application server is what would break that and force a leader-election or external-scheduler design.

### Conditions that would change this decision

Reconsider AWS if any of the following becomes true:

- Sustained traffic exceeds what one server can absorb, after the preparation items are complete and the registration transaction has been load-tested.
- Someone other than the current maintainer owns infrastructure operations.
- A sponsor, federation, or partner contract requires an availability guarantee that a single-server design cannot underwrite.

Until then, the preparation work listed above affects reliability considerably more than the choice of provider. Neither option is highly available at this budget; both begin from a single-database design. A tested restore procedure is worth more than any managed service purchasable at this price point.
