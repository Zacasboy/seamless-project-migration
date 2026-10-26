# Pallessiani Commerce Studio — Product Blueprint

## 1. Purpose and current state

Pallessiani is a fashion e-commerce and dropshipping CRM. The existing repository is a Lovable-managed React + TypeScript + Vite/TanStack Router application using Supabase. Preserve this stack and the Lovable-to-GitHub workflow unless a deliberate architecture decision says otherwise.

The current administrative route is `src/routes/_authenticated/admin.tsx`. It is a visual prototype with sample data, not a production CRM. Supplier cards, metrics, customer examples and outfit suggestions must be treated as demo data until connected to authenticated services. Do not represent integrations as connected unless a live API connection has been verified.

## 2. Product areas

### Public storefront
- Editorial fashion landing page and responsive catalog.
- Product search, category, gender, size, colour, price and collection filters.
- Product detail pages with valid images, variants, availability, price, shipping/returns and accessible alt text.
- Cart and checkout integration, order status, wishlists and saved outfits.
- SEO title, description, canonical URL, Open Graph metadata, structured product data and readable slugs.
- Outfit suggestions based on product views, saved items, compatible categories, stock, sizes and user-selected preferences.

### Private admin / CRM
- Overview dashboard with clearly labelled real vs demo metrics.
- Products: create/edit/archive, variants, supplier SKU, cost, retail price, margin, stock/availability, category, gender, sizes, colours, image review, SEO completeness and publication state.
- Customers: consent-aware profile, orders, lifetime value, recency/frequency, segments and customer-service notes.
- Supplier directory and per-supplier connection state, API capabilities, synchronization health, last sync, import logs and error handling.
- Marketing channels: Meta, Google Merchant Center/Ads, TikTok, Pinterest and email marketing. Campaign writes require valid account permissions and explicit confirmation.
- Analytics: page/product views, add-to-cart, checkout, purchases, campaign attribution and conversion funnels. Respect cookie consent and retention rules.
- Outfit studio: product compatibility, recommendations, 3D/2D preview, size guidance and saved outfit/cart items.
- Settings: team members, roles, audit log, privacy settings and integration secrets status (never reveal secret values).

## 3. Suggested data model

Use Supabase/PostgreSQL with foreign keys, timestamps, constraints, indexes and Row Level Security. Prefer migrations over manual schema drift.

Core tables:
- `user_roles(user_id, role)`: roles assigned explicitly; no public self-promotion.
- `products(id, slug, title, description, category_id, gender, status, seo_title, seo_description, created_at, updated_at)`.
- `product_variants(id, product_id, sku, size, colour, price, cost, currency, availability, supplier_id, supplier_sku)`.
- `product_images(id, product_id, storage_path, alt_text, source_url, review_status, sort_order)`.
- `categories(id, name, slug, parent_id)`.
- `suppliers(id, name, website, region, integration_type, connection_status, last_synced_at, capabilities, notes)`.
- `supplier_sync_runs(id, supplier_id, started_at, finished_at, status, imported_count, error_summary)`.
- `customers(id, auth_user_id, email, consent_status, created_at)`.
- `customer_segments(id, name, description, criteria_json, updated_at)`.
- `customer_segment_memberships(customer_id, segment_id, assigned_at, rationale)`.
- `customer_notes(id, customer_id, author_id, note, created_at)`.
- `orders(id, customer_id, status, currency, subtotal, shipping, tax, total, created_at)`.
- `order_items(id, order_id, variant_id, quantity, unit_price, supplier_cost_snapshot)`.
- `marketing_channels(id, name, provider, connection_status, external_account_id)`.
- `campaigns(id, channel_id, name, status, budget, currency, external_campaign_id)`.
- `analytics_events(id, anonymous_session_id, customer_id nullable, event_name, product_id nullable, campaign_id nullable, consent_state, created_at)`.
- `outfits(id, customer_id nullable, session_id nullable, name, created_at)`.
- `outfit_items(outfit_id, product_variant_id, position)`.
- `integration_secrets`: do not store raw credentials in client-readable tables; use server-side secrets / Supabase Vault / provider-managed secret storage.
- `audit_logs(id, actor_id, action, target_type, target_id, created_at)`.

SWOT and PESTEL:
- Use SWOT primarily for aggregated business/customer-service observations and editable, explainable notes.
- Use PESTEL for market context (political, economic, social, technological, environmental, legal), not as a method to infer sensitive personal traits.
- Store the source, timestamp, confidence and rationale for automated suggestions; allow correction and deletion. Do not use these frameworks to infer protected or sensitive attributes.

## 4. Supplier catalogue (discovery list, not confirmed integrations)

At least 20 candidates for research:
1. CJdropshipping
2. Amazon Seller Central (seller/catalog APIs; not a general dropshipping API)
3. Zendrop
4. AliExpress
5. DSers
6. Spocket
7. Printful
8. Printify
9. BigBuy
10. Syncee
11. Modalyst
12. SaleHoo
13. Alibaba
14. Inventory Source
15. AutoDS
16. Dropified
17. Wholesale2B
18. Avasam
19. Gelato
20. Trendsi
21. FashionGo

Before implementing each connector, verify official API availability, commercial terms, geographic coverage, rate limits, product-image rights, inventory/order capabilities, authentication flow and whether the account tier includes API access. A directory or marketplace is not necessarily a supplier API. Show statuses such as `Not configured`, `Connected`, `Syncing`, `Needs attention`, and `Unavailable`; never fake a live connection.

## 5. Outfit recommendation and 3D experience

Progressive implementation:
1. Deterministic outfit rules using category compatibility, colour palette, season, occasion, price range, size availability and stock.
2. Ranking using first-party events (product views, favourites, cart additions) with consent and retention controls.
3. Generic avatar if the user declines to upload a full-body image.
4. Optional full-body image flow only after explicit consent. Prefer in-browser processing. If a secure server-side model is required, use short-lived memory/temp storage, no database/object-storage persistence, no logging of image bytes, strict file limits and immediate cleanup in success and failure paths.
5. A real 3D try-on requires licensed 3D garments/body assets and a validated body-measurement/fit provider or a dedicated computer-vision pipeline. Do not claim precise measurements from a single 2D photo unless validated.
6. The user may save an outfit to the cart. Persist product/variant IDs, selected sizes and recommendation metadata only. Never persist the original body photo or an image-derived body mesh by default. If a generated preview image is ever stored, require a separate opt-in and documented retention policy.

Photo controls must support file upload and camera capture, visible consent, preview, retry, removal, and cleanup. Reject unsupported files and oversized images. Avoid analytics events that contain images or measurements.

## 6. Security and privacy requirements

- Enforce authorization in database policies and server-side functions, not only in route visibility.
- New signups receive `user` role only. Grant admin privileges through a trusted, explicit procedure.
- RLS on every table exposed to Supabase client APIs; test anonymous, ordinary-user and admin access separately.
- Never trust client-editable user metadata as an authorization source.
- Keep service-role keys and supplier/ad-platform credentials out of frontend bundles, repository files, browser storage and logs.
- Use server-side Edge Functions or a trusted backend for privileged supplier and marketing API calls.
- Rate-limit public endpoints and validate all external input with schemas.
- Minimize customer data; support access, correction, export and deletion where legally required.
- Implement cookie/analytics consent and a documented retention schedule.
- Log administrative actions without logging secrets, payment details or body-photo bytes.
- Treat payment card data as the payment provider's responsibility; use hosted/tokenized checkout.

## 7. Definition of done

A feature is not production-ready until:
- loading, empty, success and error states exist;
- permissions and RLS policies are tested;
- forms validate input and explain failures;
- no demo metrics are presented as live data;
- keyboard and mobile accessibility are reviewed;
- secrets are kept server-side;
- tests and build/lint checks pass;
- documentation explains configuration and rollback.
