# Claude: promote `aurora-v2` to `main`

## Start here

Claude: read this entire file before taking action. Then inspect the repository guidance it references, do the promotion work in a safe temporary branch, resolve conflicts, run the required validation, and prepare or update the pull request into `main`. Mike should only need to point you here and provide approval for actions that change production data or irreversibly move a protected branch.

You are responsible for discovering the current repository state rather than assuming the examples below are still exact. Preserve the intended `app/` + `web/` monorepo, do not commit secrets, and report your decisions and validation evidence when finished.

## What this change is

`aurora-v2` is the branch that contains the current Astryon handoff:

- the repository is now a monorepo with two independent projects: `app/` and `web/`;
- the Astryon application lives in `app/` and the marketing site lives in `web/`;
- both projects have their own dependencies, lockfiles, build commands, and Vercel Root Directory;
- root and project-level `AGENTS.md`/`CLAUDE.md` files route agents to the correct instructions;
- `docs/DEPLOYMENT_HANDOFF.md` contains the production setup for Vercel, Neon, Google OAuth, Resend, Upstash, AI providers, Blob, and DNS;
- `docs/REVIEW_NOTES.md` records validation evidence, accepted risks, and launch follow-ups.

This is intended to become the new production baseline. It is not a small feature branch.

## Why the pull request may show conflicts

The existing `main` branch contains an earlier MVP release, while `aurora-v2` contains the newer monorepo/application structure. They have overlapping edits in application files, documentation, and configuration. GitHub may therefore show the pull request as `CONFLICTING` even though the target is intentionally a replacement baseline.

Do not resolve this by blindly choosing “ours” or “theirs” for every file. The correct result is the complete `aurora-v2` monorepo, while preserving any genuinely newer production fixes that exist only on `main`.

## Recommended promotion workflow

### 1. Protect the current production branch

Before merging, create a backup branch from the current remote `main`. Mike must have repository write access for this step, and branch administration may be required depending on the repository rules.

```bash
git fetch origin main aurora-v2
git switch -c backup/main-before-aurora-v2 origin/main
git push origin backup/main-before-aurora-v2
```

If the repository uses `upstream` for `mdiskint/aurora_v2`, substitute `upstream` for `origin`.

### 2. Give the agent a clean integration branch

Create a temporary branch from the current `main` and merge the handoff branch into it. This keeps conflict resolution separate from both protected branches.

```bash
git fetch origin main aurora-v2
git switch -c promote/aurora-v2-to-main origin/main
git merge --no-ff origin/aurora-v2
```

If Git reports conflicts, resolve them file by file. The target structure should have:

```text
app/
  package.json
  prisma/
  server/
web/
  package.json
docs/
AGENTS.md
CLAUDE.md
README.md
```

Do not restore the old single-project root layout. Do not commit `.env`, `.env.local`, API keys, OAuth credentials, database URLs, or Vercel tokens.

### 3. Validate the integration branch

From the repository root:

```bash
git diff --check

cd app
npm ci --ignore-scripts
npm run build
npx tsc --noEmit
npx prisma generate
npx prisma migrate deploy

cd ../web
npm ci --ignore-scripts
npm run build
npx tsc --noEmit
```

Run `npx prisma migrate deploy` only with the intended production Neon `DATABASE_URL`, and confirm the migration target before executing it. It changes the database schema.

Before pushing, inspect the final diff and check for secrets:

```bash
git status --short
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- . ':!package-lock.json'
```

### 4. Push the integration branch and review it

```bash
git push -u origin promote/aurora-v2-to-main
```

Open a PR from `promote/aurora-v2-to-main` into `main`, or update PR #5 if the resolved branch is still suitable for that review. The PR description should state that this is a baseline promotion, list the two Vercel projects, include the validation commands, and identify any unresolved production risks.

### 5. Merge and configure the default branch

After review and successful checks:

1. Merge the promotion PR into `main` using the repository’s required merge method.
2. In GitHub, open **Settings → Branches** and confirm `main` is the default branch.
3. Set both Vercel projects’ Production Branch to `main`.
4. Confirm the two Vercel Root Directories remain `app` and `web`.
5. Deploy or promote the production deployments only after the environment variables and DNS records in [`DEPLOYMENT_HANDOFF.md`](./DEPLOYMENT_HANDOFF.md) are configured.

If GitHub prevents the merge because of branch protection, Mike needs to approve the PR, satisfy required checks, or temporarily adjust the repository rule. Do not force-push `main` unless Mike explicitly chooses that administrative path and the backup branch exists.

## Agent completion contract

Do not declare success until you have:

1. Read `AGENTS.md`, `CLAUDE.md`, `docs/README.md`, `docs/DEPLOYMENT_HANDOFF.md`, and `docs/REVIEW_NOTES.md`.
2. Fetched the current remote `main` and `aurora-v2`.
3. Created a recoverable backup reference for the current `main`.
4. Integrated `aurora-v2` into a temporary promotion branch and resolved conflicts deliberately.
5. Verified the monorepo layout and checked that no secrets or environment files are staged.
6. Run `git diff --check`, both production builds, and type-checks when dependencies are available.
7. Pushed the promotion branch and prepared or updated a PR into `main`.
8. Reported the PR URL, final commit, conflicts resolved, validation results, failed checks, and anything Mike must still do.

Ask Mike before running a production Prisma migration, changing production infrastructure, force-pushing or deleting `main`, or making a decision where the intended behavior cannot be inferred from the repository documentation. Everything else in this runbook is normal implementation work for the agent to carry out.

## After the merge

Use [`DEPLOYMENT_HANDOFF.md`](./DEPLOYMENT_HANDOFF.md) for the operational launch. In particular, Mike must still:

- configure the shared Neon, Resend, Upstash, Google, AI, and Blob credentials in the appropriate Vercel projects;
- apply Prisma migrations to Neon;
- configure Google’s production callback URL;
- configure Resend SPF/DKIM and verify the sending domain;
- attach `astryon.com` to `web` and `app.astryon.com` to `app`;
- test marketing signup, invitation delivery, Google sign-in, database persistence, AI routes, and Blob uploads.

The local Express/Socket.IO server is not deployed by the current Vercel setup. If production realtime behavior is required, it needs a separate persistent service and a follow-up deployment design.
