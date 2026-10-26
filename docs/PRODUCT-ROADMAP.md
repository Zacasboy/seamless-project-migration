# Pallessiani — Product Scope and Roadmap

## Vision
A fashion e-commerce storefront and private CRM for catalogue management, dropshipping operations, marketing channels, analytics, customer segmentation and outfit recommendations.

## Phase 1 — Safe foundation
- Public storefront remains separate from the private admin workspace.
- Supabase authentication plus database-backed admin role checks.
- No automatic admin role assignment on signup.
- RLS and least-privilege grants for all private data.
- Preserve Lovable synchronization and avoid secrets in the client.

## Phase 2 — Catalogue and CRM
- Product records: title, slug, description, validated image, image alt text, price, currency, category, garment type, gender/fit, size, colour, supplier, stock status, SEO title and meta description.
- Product import pipeline with field validation, duplicate detection, image rights/provenance and supplier availability timestamps.
- Customer segmentation based on first-party interactions and purchases. SWOT/PESTEL must be treated as editable business analysis, not unsupported personal profiling.
- Supplier registry with connection status, supported operations, API documentation link, last sync, errors and rate limits.
- Marketing channel configuration with credentials held server-side.
- Analytics with consent-aware event tracking, data minimization and retention rules.

## Phase 3 — Outfit recommendations
- Start with transparent rules: viewed category, complementary garments, size availability, budget and stock.
- Store product IDs and outfit selections in the cart; do not store the original body photo.
- Photo upload must be optional, size/type validated, locally previewed and discarded when the user exits or clears it.
- Camera capture requires a clear browser permission prompt and separate consent.
- A true body measurement or 3D try-on service requires a separately reviewed vendor, data-processing agreement, explicit consent and a documented retention/deletion policy. Do not send body photos to third parties by default.
- If photo is declined, use a generic avatar selected by garment fit/body-shape preference. Do not infer sensitive characteristics.

## Phase 4 — Production integrations
Potential providers to evaluate (not connected by this list): CJdropshipping, Amazon Seller Central, Zendrop, AliExpress, DSers, Spocket, Printful, Printify, BigBuy, Syncee, Modalyst, SaleHoo, Alibaba, Inventory Source, AutoDS, Dropified, Wholesale2B, Avasam, Gelato, Trendsi and FashionGo.
Before implementing each connector, verify official API access, country coverage, commercial terms, inventory sync, order fulfilment, webhooks, rate limits and required subscription. Some providers are marketplaces, directories or print-on-demand services rather than interchangeable dropshipping APIs.

## Current prototype boundaries
- CRM screen data and charts are illustrative and are not live Supabase analytics.
- Supplier cards are a directory only; no provider is authenticated or connected.
- The outfit preview is a local UI prototype, not a real 3D avatar or body-measurement engine.
- The browser-only image preview is not uploaded to the database or a remote service.
- Add backend persistence and automated tests in a later phase before production use.
