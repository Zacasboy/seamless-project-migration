---
name: supabase-rls-audit
description: Audit or implement Supabase roles, RLS, grants, triggers, and migrations for the Pallessiani CRM without risking production lockout.
---

# Supabase RLS audit

- Inspect the current schema and migration history before proposing changes.
- Separate authenticated users from administrators; client-editable user metadata is not an authorization source.
- Check RLS enabled state, grants, SELECT/INSERT/UPDATE/DELETE policies, views, RPCs and SECURITY DEFINER functions.
- Verify function search_path and whether parameters can be spoofed.
- Signup triggers must grant only the ordinary user role. Admin promotion must be explicit and owner-controlled.
- Audit existing admin assignments before removing any privileges; never silently demote the legitimate owner.
- Do not execute destructive production changes without explicit confirmation and a verified recovery path.
- Keep credentials out of files and responses. Prefer a project-scoped, read-only MCP connection for inspection.
- Produce a migration, verification queries, rollback notes, and a checklist of tests.
