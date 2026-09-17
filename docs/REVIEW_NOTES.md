# Deployment review notes

Reviewed: 2026-09-17  
Branch reviewed: `aurora-v2`  
Repository: `mdiskint/aurora_v2`

## Scope

The review covered the app/web monorepo migration, the two Vercel project configuration, production environment variables, DNS and OAuth instructions, shared Neon/Resend/Upstash dependencies, and the application’s local-only Express/Socket.IO server.

The review used local repository inspection and an independent read-only Pi review through `vercel-ai-gateway/deepseek/deepseek-v4-flash`. The Pi reviewer received explicit authorization to review the deployment materials. No review agent was permitted to edit the repository.

## Verified

- The application lives under `app/` and the marketing site under `web/`.
- Both projects have their own `package.json` and lockfile.
- The intended Vercel configuration is two projects from the same GitHub repository:
  - application Root Directory: `app`
  - marketing Root Directory: `web`
- The production domains are `https://astryon.com` and `https://app.astryon.com`.
- The Google OAuth callback is `https://app.astryon.com/api/auth/callback/google`.
- The application build runs `prisma generate && next build`.
- The marketing build completes independently.
- Prisma migrations are committed under `app/prisma/migrations/`.
- The production guide tells operators to use `prisma migrate deploy`, not `prisma migrate dev`.
- The marketing signup route uses the shared Neon database, Resend, and Upstash Redis.
- The marketing route needs `NEXTAUTH_URL=https://app.astryon.com` to generate application invite links.
- The local `app/server/` Express/Socket.IO service is explicitly excluded from the current Vercel production path.
- The repository contains no committed `.env` or API-key files in the monorepo documentation changes.

## Findings and decisions

### Medium — realtime collaboration is not a Vercel production service

The Express/Socket.IO server under `app/server/` is not deployed to Vercel. This is acceptable for the current beta because production is intentionally configured to use same-origin Next.js route handlers and no external Socket.IO connection.

If realtime collaboration becomes a production requirement, it needs a separately hosted persistent service and an explicit production authorization/configuration change. Do not silently deploy the current server as a Vercel function and expect persistent WebSocket behavior.

### Medium — preserve the production NextAuth secret

`NEXTAUTH_SECRET` must be a stable, high-entropy value stored in Vercel. It must not be regenerated for each deployment; changing it invalidates existing sessions and can break encrypted model configuration data.

### Medium — apply migrations before feature verification

Vercel’s build generates the Prisma client but does not automatically apply database migrations. Mike must apply committed migrations to the production Neon database before testing flows that depend on the current schema:

```bash
cd app
npx prisma migrate deploy
```

Use a Neon backup or branch and a deliberate rollback plan before applying migrations.

### Medium — monitor invite delivery

The marketing signup route can create a signup record before Resend successfully delivers the invitation. Mike should monitor Resend delivery and use the application’s admin re-invite flow when an invite needs to be resent.

### Low — bootstrap the operator account

The configured operator email in `ADMIN_EMAILS` should have an approved `BetaSignup` record before launch testing. This avoids an operator-control-surface chicken-and-egg problem.

### No finding — marketing `NEXTAUTH_URL`

The marketing project does not authenticate users directly, but it does use `NEXTAUTH_URL` to construct links into the application’s `/join` route. Keep this variable on the marketing project and point it to `https://app.astryon.com`.

## Validation evidence

- `npm ci --ignore-scripts` completed for both projects.
- `npm run build` completed for `app/` after allowing Prisma’s engine download.
- `npm run build` completed for `web/` after allowing Google Font downloads.
- `git diff --check` passed for the documentation and monorepo changes.
- The branch was pushed successfully to `upstream/aurora-v2`.

## Pre-launch decisions still required

1. Confirm that realtime collaboration remains out of scope for the first production beta.
2. Confirm Mike has Vercel, Neon, Google Cloud, Resend, Upstash, provider-key, and DNS access.
3. Apply and verify Prisma migrations against the production Neon database.
4. Verify the Resend sending domain and SPF/DKIM records.
5. Add the production Google OAuth callback and test sign-in on `app.astryon.com`.
