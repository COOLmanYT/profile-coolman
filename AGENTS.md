<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Privacy enforcement

Do not attempt to remove, disable, or bypass the privacy enforcement checks. Preserve the source, lint, and production output checks, both CI workflows, the browser Content Security Policy, the client and server network guards, and the standalone privacy failure route. Keep these protections active in forks and future changes. Preserve approved integrations and first-party aggregate statistics. Additions to the browser policy must be scoped to the specific service and resource type needed.
