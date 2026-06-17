# RaceDZ New PC Setup

Use this when setting up RaceDZ on another computer.

## 1. Prepare GitHub SSH Access

If this PC already uses another GitHub account for work, create a separate SSH key for the RaceDZ account:

```bash
ssh-keygen -t ed25519 -C "elmererbi.youcef@gmail.com" -f ~/.ssh/id_ed25519_racedz
```

Print the public key:

```bash
cat ~/.ssh/id_ed25519_racedz.pub
```

Add it to GitHub:

`GitHub -> Settings -> SSH and GPG keys -> New SSH key`

Then configure SSH:

```bash
nano ~/.ssh/config
```

Add:

```sshconfig
Host github-racedz
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_racedz
  IdentitiesOnly yes
```

Test:

```bash
ssh -T git@github-racedz
```

Expected result:

```text
Hi youcefbl! You've successfully authenticated, but GitHub does not provide shell access.
```

## 2. Clone The Project

Use the SSH alias if this PC has multiple GitHub accounts:

```bash
git clone git@github-racedz:youcefbl/racedz.git
cd racedz
```

If this PC only uses the RaceDZ GitHub account, this also works:

```bash
git clone git@github.com:youcefbl/racedz.git
cd racedz
```

## 3. Set Repo-Local Git Identity

Do this inside the `racedz` folder:

```bash
git config user.name "Youcef"
git config user.email "elmererbi.youcef@gmail.com"
```

Check:

```bash
git config user.name
git config user.email
```

This affects only this repo, not your global work Git account.

## 4. Create Local Environment File

```bash
cp .env.example .env
```

Edit `.env` if needed:

```bash
nano .env
```

Important:

- Do not commit `.env`.
- `.env` is ignored by `.gitignore`.
- Each PC should have its own `.env`.

## 5. Install Dependencies

```bash
npm install
```

## 6. Start Local PostgreSQL

Make sure Docker is installed and running, then:

```bash
docker compose up -d postgres
```

Check:

```bash
docker compose ps
```

## 7. Prepare Database

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Demo accounts:

- `runner@example.com`
- `organizer@racedz.dz`
- `admin@racedz.dz`

Password:

```text
racedz-demo-password
```

## 8. Start Development Server

```bash
npm run dev
```

Open the URL printed by Next.js, usually:

```text
http://127.0.0.1:3003
```

RaceDZ intentionally uses fixed local port `3003` because Auth.js redirects are configured for that origin. If port `3003` is busy, stop the other process instead of switching ports.

## Daily Workflow Between Two PCs

Before leaving PC 1:

```bash
git status
npm run lint
npm run typecheck
git add .
git commit -m "Describe your changes"
git push
```

On PC 2 before starting:

```bash
git pull
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Notes:

- Run `npm install` when `package.json` or `package-lock.json` changed.
- Run Prisma commands when `prisma/schema.prisma` or migration files changed.
- Do not copy `node_modules`, `.next`, or `.env` between PCs.

## Codex Context On The New PC

Start a new Codex session with:

```text
Read TODO.md, CODEX_CONTEXT.md, and AGENTS.md, then continue from the current priority.
```

There is no reliable way to keep the exact same live Codex chat session across two PCs. The reliable workflow is Git plus the repo context files.
