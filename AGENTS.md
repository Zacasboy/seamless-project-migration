<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->


# Pallessiani Commerce Studio — project rules

## Project context
This is a Lovable-managed React + TypeScript + Vite/TanStack Router + Supabase fashion e-commerce/CRM. Preserve the existing stack and Lovable synchronization. Work in feature branches; do not merge to `main` unless explicitly requested.

## Rules for all coding agents
- Inspect existing routes, components, schema, types and migrations before editing.
- Separate demo data from production data; label demo metrics clearly.
- Never invent a working supplier/API connection. Verify official APIs and document limitations.
- Never put API secrets, service-role keys or tokens in frontend code, browser storage, commits or logs.
- Admin authorization must be enforced by trusted database policies and server-side checks. Hiding a link is not authorization.
- New accounts receive only the ordinary user role. Public signup must never select its own role.
- Body photos are sensitive personal data: do not persist them in Supabase, object storage, analytics or logs. Use temporary processing, explicit consent, type/size checks and cleanup. Save outfit product/variant IDs rather than the photo.
- Do not claim accurate body measurements or real 3D try-on unless a validated implementation exists.
- SWOT/PESTEL analyses must be explainable and correctable. Do not infer protected or sensitive customer attributes.
- Add accessible labels, keyboard navigation, responsive layouts, clear loading/error/empty states and schema validation.
- Add tests for security-critical behavior. Report exactly what was changed and what was tested.

## Suggested agent responsibilities
- **Product architect:** requirements, data model, scope and delivery sequencing.
- **Frontend/UX engineer:** storefront and admin UI using the existing component system.
- **Supabase security engineer:** RLS, roles, grants, triggers, Edge Functions, secrets and authorization tests.
- **Integration engineer:** official supplier/marketing APIs, scopes, rate limits, retries, idempotency and honest connection statuses.
- **Recommendation/3D engineer:** transparent outfit rules, licensed assets, ephemeral image processing and accurate fit disclaimers.
- **QA/release engineer:** build, lint, unit tests, role/RLS tests, migration order and Lovable-compatible changes.
