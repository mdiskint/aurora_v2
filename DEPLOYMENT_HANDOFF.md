# Astryon production handoff

This document is for Mike. It covers the application and marketing site after the repository migration to a monorepo.

## 1. Repository structure

```text
aurora_v2/
├── app/   # Astryon application
└── web/   # Marketing site
```

These are separate Next.js projects in one Git repository. They must be created as two separate Vercel projects, each with a different Root Directory.

The application is the production system of record. The marketing site’s beta-signup endpoint writes to the same Neon database and sends invitation emails through Resend.

## 2. Accounts and access Mike needs

Mike should have:

1. GitHub access to `mdiskint/aurora_v2`.
2. Vercel access to the team/account that will own both projects.
3. Neon access to the production database and permission to run Prisma migrations.
4. Google Cloud access to the OAuth client used by the app.
5. Resend access to create an API key and verify the sending domain.
6. Upstash access to create or use the Redis database used for rate limiting.
7. Provider access for Anthropic, Gemini, OpenAI, and Vercel Blob as needed.
8. DNS access at the domain registrar, unless DNS is already delegated to Vercel.

Do not commit any secret, `.env.local`, API key, OAuth secret, database URL, or Vercel token to GitHub.

## 3. Create the two Vercel projects

In Vercel, import `mdiskint/aurora_v2` twice.

### Project A: application

- Project name: `astryon-app` (or the chosen production name)
- Framework: Next.js
- Root Directory: `app`
- Install Command: default (`npm install`)
- Build Command: default (`npm run build`)
- Output Directory: default

The build script in `app/package.json` runs `prisma generate && next build`.

### Project B: marketing site

- Project name: `astryon-web` (or the chosen production name)
- Framework: Next.js
- Root Directory: `web`
- Install Command: default (`npm install`)
- Build Command: default (`npm run build`)
- Output Directory: default

Both projects can use the same GitHub repository and the same production branch. A push or merge to `main` will create a deployment for each project.

## 4. Application environment variables

Add these to the application Vercel project for Production, Preview, and Development as appropriate:

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://app.astryon.com
DATABASE_URL=...
ANTHROPIC_API_KEY=...
RESEND_API_KEY=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
ADMIN_EMAILS=admin@example.com
```

Optional application variables:

```text
GEMINI_API_KEY=...
OPENAI_API_KEY=...
BLOB_READ_WRITE_TOKEN=...
TAVILY_API_KEY=...
EMAIL_FROM=Astryon <noreply@astryon.com>
```

Notes:

- `NEXTAUTH_URL` must be the application URL, not the marketing URL.
- `NEXTAUTH_SECRET` must be a long random production secret. Do not reuse a development secret.
- `ADMIN_EMAILS` is a comma-separated allowlist of operator emails. The operator also needs to be represented by an approved beta-signup record before the operator control surface can approve applicants.
- Anthropic powers the default AI path. Gemini and OpenAI are optional unless the corresponding features are used.
- `BLOB_READ_WRITE_TOKEN` is required for Vercel Blob-backed video uploads.
- `TAVILY_API_KEY` is only needed if the search feature is enabled.
- Do not set `NEXT_PUBLIC_SERVER_URL` in production.

## 5. Marketing-site environment variables

Add these to the marketing Vercel project:

```text
DATABASE_URL=...
RESEND_API_KEY=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
NEXT_PUBLIC_WEB_URL=https://astryon.com
NEXTAUTH_URL=https://app.astryon.com
```

The marketing site uses:

- `DATABASE_URL` to create `BetaSignup` rows in the shared Neon database.
- `RESEND_API_KEY` to send invitation emails.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to rate-limit public signup requests.
- `NEXT_PUBLIC_WEB_URL` for the marketing API’s allowed origin.
- `NEXTAUTH_URL` to build invitation links pointing to the application’s `/join` page.

## 6. Neon database and Prisma migrations

The application owns the Prisma schema and migrations under `app/prisma/`.

Before the first production launch:

1. Confirm `DATABASE_URL` points to Mike’s production Neon database.
2. Take or confirm a Neon backup/branch exists.
3. From the application directory, install dependencies and generate Prisma:

   ```bash
   cd app
   npm install
   npx prisma generate
   ```

4. Apply committed migrations against the production database:

   ```bash
   npx prisma migrate deploy
   ```

5. Verify that the expected tables exist, especially `User`, `Account`, `Session`, `Universe`, and `BetaSignup`.

Do not use `prisma migrate dev` against the production database.

## 7. Google OAuth setup

In Google Cloud Console, configure the OAuth client with the production callback URL:

```text
https://app.astryon.com/api/auth/callback/google
```

Keep the local callback URL too if local development is still needed:

```text
http://localhost:3000/api/auth/callback/google
```

Use the exact same client ID and secret in the application Vercel project. Test sign-in after the custom domain is active because NextAuth’s secure-cookie behavior depends on the production URL.

## 8. Resend setup

In Resend:

1. Add and verify the sending domain.
2. Add the SPF/DKIM records Resend provides at the DNS provider.
3. Use a sender address on that verified domain, such as `noreply@astryon.com`.
4. Create an API key scoped to the required projects.
5. Add it as `RESEND_API_KEY` to both Vercel projects.
6. Set `EMAIL_FROM` for the application if the default sender should be changed.

The marketing signup route currently sends invitation links to the application’s `/join` route.

## 9. Upstash Redis setup

Create or select an Upstash Redis database and copy its REST URL and REST token into both Vercel projects:

```text
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

The public beta signup and application rate limits are deny-closed when the limiter is unavailable, so these variables should be present before launch.

## 10. AI and Blob providers

Add the provider keys only to the application project:

- Anthropic: `ANTHROPIC_API_KEY` — required for the default AI experience.
- Google AI: `GEMINI_API_KEY` — required for video analysis or Gemini features.
- OpenAI: `OPENAI_API_KEY` — required for OpenAI-backed features.
- Vercel Blob: create a Blob store in the Vercel project and add `BLOB_READ_WRITE_TOKEN` for video uploads.
- Tavily: `TAVILY_API_KEY` — optional search integration.

Never expose these as `NEXT_PUBLIC_*` variables.

## 11. Custom domains and DNS

Choose the final hostnames first. A sensible arrangement is:

```text
Marketing site: https://astryon.com
Application:    https://app.astryon.com
```

### Add the marketing domain

1. Open the marketing Vercel project.
2. Go to Settings → Domains.
3. Add `astryon.com` and, if desired, `www.astryon.com`.
4. Vercel will show the exact DNS records for the project.
5. At the registrar/DNS provider, add the records Vercel requests.

For a typical Vercel setup, the apex domain uses an A record and a subdomain uses a CNAME. Do not guess the value: use the exact value shown by Vercel’s domain inspection screen. Vercel’s current documentation lists `76.76.21.21` and `cname.vercel-dns-0.com` as general-purpose examples, but project-specific values shown in the dashboard take precedence.

### Add the application subdomain

1. Open the application Vercel project.
2. Add `app.astryon.com` under Settings → Domains.
3. Add the CNAME record Vercel provides for `app` at the DNS provider.
4. Wait for DNS verification and HTTPS certificate issuance.

If using Vercel nameservers, delegate the domain’s nameservers to Vercel and manage the records there. Otherwise leave nameservers at the current registrar and add the A/CNAME records there. Do not add competing A or CNAME records for the same hostname.

### After DNS is live

Update:

- Application `NEXTAUTH_URL` → `https://app.astryon.com`
- Marketing `NEXT_PUBLIC_WEB_URL` → `https://astryon.com`
- Marketing `NEXTAUTH_URL` → `https://app.astryon.com`
- Google OAuth production callback → `https://app.astryon.com/api/auth/callback/google`
- `EMAIL_FROM` → a sender on the verified domain

## 12. Production launch test

### Marketing project

1. Load the custom marketing URL.
2. Submit a test beta-signup email.
3. Confirm the request creates one `BetaSignup` record in Neon.
4. Confirm the invite email arrives through Resend.
5. Confirm the link points to `https://app.astryon.com/join?...`.
6. Submit repeated requests and confirm rate limiting responds safely.

### Application project

1. Open `https://app.astryon.com`.
2. Sign in with Google.
3. Redeem the invite link.
4. Confirm the session persists after refresh.
5. Create a universe/nexus and confirm it persists to Neon.
6. Test AI chat and confirm the request stays same-origin under `/api/chat`.
7. Test video upload if Blob is configured.
8. Confirm browser developer tools show no production connection to `localhost:3001` or an external Socket.IO server.

The Express/Socket.IO server under `app/server/` is for local development only. It is not part of the production Vercel deployment.

## 13. GitHub and Vercel branch behavior

Create a pull request from `aurora-v2` into `main`, review the monorepo migration, and merge it. Configure both Vercel projects to use `main` as the Production Branch. Each project will deploy from its own Root Directory:

- Application project: `app`
- Marketing project: `web`

Preview deployments will be created for pull requests. Use them to test the marketing and application projects separately before merging.

## 14. Rollback

- Vercel: promote the previous successful deployment from the Deployments page.
- GitHub: revert the merge commit if the code itself must be rolled back.
- Database: do not blindly reverse migrations. Inspect the migration and use a deliberate, backed-up rollback plan.
- Secrets: rotate any key that may have been exposed; do not merely redeploy.

## 15. Items to confirm before final launch

- Final marketing domain and application subdomain.
- Which Vercel team owns both projects.
- Which Google OAuth client is authoritative.
- Verified Resend sending domain and sender address.
- Production Neon database URL and migration window.
- Upstash Redis database and rate-limit budget.
- Whether Gemini, OpenAI, Tavily, and Blob are enabled for the first release.
