# Astryon monorepo guide

This repository contains two independent Next.js projects:

| Directory | Purpose | Vercel Root Directory |
|---|---|---|
| `app/` | Astryon application | `app` |
| `web/` | Marketing site and beta signup | `web` |

Read the project-specific guide before changing code:

- [`app/AGENTS.md`](./app/AGENTS.md) — application architecture, APIs, Prisma, auth, AI, and local server
- [`web/AGENTS.md`](./web/AGENTS.md) — marketing-site conventions and validation
- [`DEPLOYMENT_HANDOFF.md`](./DEPLOYMENT_HANDOFF.md) — Mike’s production deployment checklist
- [`REVIEW_NOTES.md`](./REVIEW_NOTES.md) — deployment review findings and open risks

## Repository rules

- Keep `app/` and `web/` independently installable and buildable. Do not create a root package manager workspace unless the deployment plan is updated accordingly.
- Run commands from the project they affect: `cd app` for the application and `cd web` for the marketing site.
- Do not commit `.env`, `.env.local`, API keys, OAuth secrets, database URLs, or Vercel tokens.
- The application’s `server/` directory is for local Express/Socket.IO development. It is not deployed to Vercel for the current production beta.
- The application and marketing site share production services deliberately: Neon for the database, Resend for invitations, and Upstash Redis for rate limiting. Coordinate changes to their schemas and environment variables.
- Preserve Prisma migration history under `app/prisma/migrations/`. Use `npx prisma migrate deploy` for production; never use `prisma migrate dev` against production.
- Treat `main` as the production branch once Mike merges the `aurora-v2` pull request. Both Vercel projects should use `main` as their Production Branch.

## Common commands

```bash
# Application
cd app
npm install
npm run dev
npm run lint
npm run build
npx tsc --noEmit

# Marketing site
cd web
npm install
npm run dev
npm run lint
npm run build
npx tsc --noEmit
```

For production configuration, use `https://astryon.com` for the marketing site and `https://app.astryon.com` for the application. The application’s Google OAuth callback is:

```text
https://app.astryon.com/api/auth/callback/google
```

## Change handoff

Before declaring a deployment-related change complete:

1. Update the relevant project guide or [`DEPLOYMENT_HANDOFF.md`](./DEPLOYMENT_HANDOFF.md).
2. Run the affected project’s lint, type-check, and build commands when dependencies are available.
3. Confirm the Git diff contains no secrets or local-only artifacts.
4. Report database migrations, environment-variable changes, DNS changes, and rollback considerations explicitly.
