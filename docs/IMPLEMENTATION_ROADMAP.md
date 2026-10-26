# Pallessiani — implementation roadmap

## Milestone 0 — Stabilize foundation
- Review the admin-link removal, database-backed admin role guard and safe signup-role migration.
- Audit existing Supabase admin rows and apply migrations through the project's real deployment workflow.
- Verify `/_authenticated/admin` and database policies.
- Establish a staging environment and repeatable migration/test process.

## Milestone 1 — Real CRM foundation
- Replace demo products/customers/suppliers with typed Supabase queries.
- Add product/variant/image/category tables and validated create/edit/archive forms.
- Add pagination, filtering, image review and SEO completeness checks.
- Add customers, orders and editable segments; distinguish sample records from real customers.
- Add audit logs and role-based tests.

## Milestone 2 — Supplier directory and one real connector
- Keep the 21-provider research catalogue with all unverified providers marked Not configured.
- Evaluate official APIs, terms, geographic coverage, rate limits, image rights, stock/order capabilities and account tiers.
- Implement one provider first, with server-side secrets, manual sync, logs, retries and idempotency.
- Add scheduled sync only after manual sync is reliable.

## Milestone 3 — Marketing and analytics
- Implement consent-aware event schema and storefront events.
- Build aggregate dashboards from real events and orders, with UTM attribution.
- Connect one advertising channel at a time via official APIs. Require explicit confirmation before live campaign changes.
- Validate product feeds for SEO and Google Merchant Center.

## Milestone 4 — Outfit recommender
- Start with transparent deterministic rules and product-view signals.
- Save outfits to cart using product/variant IDs only.
- Provide a generic avatar if the user declines the photo.
- Prototype upload/camera with ephemeral processing and guaranteed cleanup.
- Integrate licensed 3D assets and a validated fit provider only after technical and privacy review.

## Milestone 5 — Production readiness
- Complete accessibility, responsive and error-state reviews.
- Add end-to-end tests for storefront, checkout, roles, RLS and image cleanup.
- Add backups, monitoring, rate limits, privacy notice, cookie consent and retention policy.
- Verify supplier availability, order handling, returns, shipping and product data before launch.

## Release gate
Do not call the product a complete CRM until database-backed CRUD, real role enforcement, genuine integration status, reliable analytics, privacy controls and tests replace the demo interactions.
