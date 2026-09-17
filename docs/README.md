# Astryon documentation map

Use this page when you need to find project or deployment guidance. Start with the repository-level files, then follow the project-specific path.

## Reading order

1. [`../AGENTS.md`](../AGENTS.md) — repository rules, project map, shared-service boundaries, and common commands.
2. [`../CLAUDE.md`](../CLAUDE.md) — short routing guide for Claude-based agents.
3. For application work, read [`../app/AGENTS.md`](../app/AGENTS.md) and then [`../app/CLAUDE.md`](../app/CLAUDE.md).
4. For marketing-site work, read [`../web/AGENTS.md`](../web/AGENTS.md) and then [`../web/CLAUDE.md`](../web/CLAUDE.md).
5. For production setup, read [`DEPLOYMENT_HANDOFF.md`](./DEPLOYMENT_HANDOFF.md).
6. To promote the handoff branch into `main`, read [`PROMOTE_TO_MAIN.md`](./PROMOTE_TO_MAIN.md).
7. For known risks and validation evidence, read [`REVIEW_NOTES.md`](./REVIEW_NOTES.md).

## Documentation ownership

- Root files describe the monorepo and route agents to the right project.
- `app/AGENTS.md` and `web/AGENTS.md` describe code inside their respective projects.
- `DEPLOYMENT_HANDOFF.md` describes shared production operations and must be updated when domains, providers, migrations, or Vercel settings change.
- `PROMOTE_TO_MAIN.md` explains the branch transition, conflict-resolution workflow, and agent handoff for Mike.
- `REVIEW_NOTES.md` records review evidence, accepted risks, and outstanding launch decisions.

When a task spans both projects, read both project guides and the deployment handoff before editing. Never infer a project’s environment variables, deployment root, or runtime behavior from the other project.
