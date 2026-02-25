# Project Guidelines

## Project Overview
This repository contains an advanced WordPress Management tool, for WordPress administrators who manages own servers with Plesk or cPanel.

This is a single-user tool with no authentication or other security provided by the application. Security is out of scope for the project and is the users sole responsibility if they choose to host it on a public server. 

## MCP Servers
- Always check the MCP-server for Nuxt UI v4 when building the frontend.
- Always check the Nuxt MCP-server when working with Nuxt.

## Tech Stack
- Framework: Nuxt (server and frontend in one codebase)
- UI: Vue + Nuxt UI v4 (Tailwind CSS)
- Icons: NuxtIcon (`<Icon>`) with the `lucide` icon set for common/simple icons
- Database: Prisma 7 with migrations and SQLite.

## Architecture & Conventions
- Prefer server routes in `server/api` for backend logic; keep them thin and type-safe.
- Use composables in `app/composables` (or `composables/` if enabled) for shared client/server logic.
- Keep Prisma access centralized (see `server/utils/db.ts`).

## UI/UX Guidelines
- Always check for an existing Nuxt UI component before building custom UI. Favor composition of Nuxt UI components over bespoke widgets.
- Avoid introducing custom design choices like extra shadows or visual flourishes that are not part of Nuxt UI defaults.
- Try not to add `<style>` blocks; rely on Nuxt UI/Tailwind utility classes. If absolutely necessary, keep styles minimal and scoped.
- Use NuxtIcon `<Icon>` with `lucide` for most simple icons to ensure consistency.
- Optimize for touch interactions (sizes, hit targets), but verify layouts also work well on mobile and desktop breakpoints.
- Use semantic colors whenever possible, such as text-success instead of text-green-500.
- Don't use text-[], ie some pixel value, use the semantic ones. Never use text-xs - it's too small.
- Remember that :model-value of a USelect and USelectMenu is just the value, not the label/value object.

## Database & Migrations
- Prisma 7 is used for schema management and migrations (`prisma/schema.prisma`).
- When schema changes are required, prefer creating a new migration via Prisma rather than editing existing committed migrations.

## Project Structure (high level)
- `app/` – Client app files (pages, components, styles like `app/main.css`)
- `server/` – API routes and server utilities (e.g., `server/api/**`, `server/utils/prisma-client.ts`)
- `prisma/` – Prisma schema, migrations, and seed scripts (e.g., `schema.prisma`, `seed.ts`)
- `public/` – Static assets (e.g., `favicon.ico`)
- `nuxt.config.ts` – Nuxt configuration
- `lib/`, `utils/` (if present) – Shared helpers

## Notes for Junie (the assistant)
- Before building custom UI, search Nuxt UI v4 for a suitable component/pattern and use it when possible.
- Prefer `<Icon name="lucide:..." />` via NuxtIcon for icons.
- Keep solutions touch-friendly by default (button sizes, spacing, inputs), and test responsiveness.
