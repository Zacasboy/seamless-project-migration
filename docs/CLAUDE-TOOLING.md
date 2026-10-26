# Claude Code tooling for Pallessiani

Use these as a starting set; check the current marketplace entry and permissions before installing. Plugin names and availability can change.

## Recommended plugins
- **Frontend Design** — UI direction and production-quality front-end implementation.
- **Supabase** — official Supabase MCP and database/auth guidance. Begin with a project-scoped, read-only connection for schema exploration; only enable writes when required.
- **GitHub** — inspect issues, branches and pull requests; review the diff before merges.
- **Playwright** — browser automation for storefront and admin smoke tests.
- **Context7** — retrieve version-specific library documentation.
- **Security Guidance** — security checks for code changes.
- **Code Review** — independent review before merging.

Marketplace: https://claude.com/marketplace/plugins
Official plugin directory: https://github.com/anthropics/claude-plugins-official

## MCP connectors
- **Supabase MCP**: schema, migrations and RLS; scope it to this project and use read-only mode for audits. Official guide: https://supabase.com/docs/guides/ai-tools/mcp
- **GitHub MCP**: source control, PRs and reviews. Official MCP server: https://github.com/github/github-mcp-server
- **Playwright MCP**: browser tests for login, catalogue, cart, accessibility and responsive layouts.
- **Context7 MCP**: current documentation for TanStack Router, React, Supabase and related packages.
- **Optional later**: analytics, email, ads, payments and supplier APIs. Only connect a provider after choosing it, verifying official API terms, and deciding what data it may access.

MCP is a developer-agent connection, not a customer-facing API. Do not expose a privileged MCP endpoint or service-role token to storefront users. Keep provider secrets in server-side environment variables or a secret manager.

## Project skills added
- add-crm-module: consistent workflow for adding CRM modules.
- supabase-rls-audit: checks roles, grants, policies, triggers and migrations.
- outfit-recommendation-privacy: privacy rules for try-on photos and saved looks.

## Project agents added
- fashion-commerce-architect: plans and implements fashion commerce features.
- security-reviewer: read-first security review for auth, RLS, uploads and third-party connectors.
- supplier-integration-engineer: supplier APIs, secure credentials, idempotency and sync failures.

## Safe installation
Use the plugin browser in the current Claude Code version to discover and install the selected plugins. Official Supabase plugin instructions: https://supabase.com/docs/guides/ai-tools/plugins

Do not install every plugin at once. Start with Frontend Design, Supabase, GitHub and Playwright. Give database-write access only when a task actually needs it.
