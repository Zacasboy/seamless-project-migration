# Pallessiani Fashion Commerce CRM

## Project context
This repository is a Lovable-synced React + TypeScript application using Vite, TanStack Router, Supabase, Tailwind CSS and shadcn-style UI components. Preserve Lovable compatibility and existing patterns. Do not replace the stack without explicit approval.

## Product goals
- Public storefront: product catalogue, product detail, cart and outfit recommendations.
- Private admin CRM: dashboard, product management, customers and segment analysis, suppliers, publishing/ad channels, traffic analytics, and outfit recommendation management.
- Supplier connectors must be shown as disconnected until credentials and a real official API integration are configured.
- Any demo metrics, users, products or statuses must be clearly labelled as demo data.

## Security requirements
- Admin access requires a valid Supabase session AND a database-backed role check.
- Never rely on hiding a link or client-side metadata as the only authorization.
- Protect every table with RLS. Only trusted server code may use service-role credentials.
- Never commit API keys, access tokens, service-role keys, or real customer data.
- New signups must never become admins automatically. Admin promotion is a deliberate owner-controlled operation.
- Keep user-uploaded try-on photos in browser memory only by default. Do not upload them to Supabase Storage, logs, analytics, or external AI providers without separate explicit consent and a documented data flow.
- If a look is saved to cart, save product IDs and look metadata, not the original body photo.

## Implementation conventions
- Inspect existing routes and components before changing them.
- Keep UI responsive and accessible, handle loading/error/empty states, and avoid false claims about integrations.
- Use TanStack file-based routing conventions and run npm run lint, npm test, and npm run build when a local environment is available.
- For Supabase changes, create a new migration; do not edit an already-deployed migration as the only fix.
- Document any action that still requires secrets, credentials, manual Supabase setup, or a paid third-party service.
