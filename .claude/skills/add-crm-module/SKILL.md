---
name: add-crm-module
description: Add or improve a Pallessiani CRM module following the existing routes, UI, Supabase security, and demo-data conventions.
---

# Add a CRM module

1. Read CLAUDE.md and inspect the existing route tree and reusable UI components.
2. Define the user flow and data model before implementing.
3. Mark demo records and disconnected integrations clearly.
4. Use typed data and input validation; handle empty, loading, error and success states.
5. If persistence is required, add a new Supabase migration with RLS policies and least-privilege grants.
6. Never implement authorization only in the UI. Use the trusted admin role check and database RLS.
7. Keep changes scoped and preserve Lovable sync.
8. Run lint, tests and build when available; list checks that could not run.
9. Summarize changed files, migration steps, security implications and remaining work.
