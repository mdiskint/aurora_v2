# Astryon monorepo

This repository contains two independent Next.js projects:

- [`app/`](./app) — the Astryon application
- [`web/`](./web) — the Astryon marketing site

Each project has its own `package.json`, lockfile, build command, and Vercel Root Directory. Deploy them as two separate Vercel projects from this repository.

Start with [`AGENTS.md`](./AGENTS.md) for repository-wide development guidance. The complete documentation map is in [`docs/README.md`](./docs/README.md). See [`docs/DEPLOYMENT_HANDOFF.md`](./docs/DEPLOYMENT_HANDOFF.md) for production setup and [`docs/REVIEW_NOTES.md`](./docs/REVIEW_NOTES.md) for deployment-readiness findings.

For instructions on moving the `aurora-v2` handoff into `main`, see [`docs/PROMOTE_TO_MAIN.md`](./docs/PROMOTE_TO_MAIN.md).
