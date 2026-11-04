# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Sovrium configuration (app.yaml + config/), rendered by the Sovrium binary on shadcn/ui base-nova; there is no hand-written front-end.

## Users

A team starting a business app of its own, who replaces the sample projects with its own records. Its users are the team, invited by an admin; strangers cannot open an account.

## Product Purpose

A business-app skeleton: every sign-in way, a dashboard, settings pages and record pages.

App starter — the skeleton most business apps grow from, built from the library's
application blocks: every way in (password, emailed link, passkey, two-step, single
sign-on, invitations), a dashboard with a period selector, settings and profile pages, and
a list of projects that each open in a side panel and on their own page.

## Capabilities and Constraints

- **Tables** (8): projects, tasks, activity, clients, people, workspace_settings, reminders, bookings
- **Pages** (24): seven sign-in pages, overview (`/`), metrics, worklist, five settings
  pages, projects, a project page and its edit page, and six `/kit/*` pages showing every
  other application block in its stock copy
- **Library blocks** (59) — every application block but the sign-up form, which an app that
  admits people by invitation leaves out: under `library/block/`, each starting with a
  `sovrium-library:` line naming the entry and version it was installed from
- **Forms** (5): the worklist's "New" dialog, the project page's "Add a task", and the
  drawer, modal and two-column forms the `/kit/data` page shows
- **Singletons**: auth
- **Seed data**: `seed/` — one file per table plus `users.yaml` (three sign-in accounts,
  one per role), dated relative to the day you seed. `sovrium start` does not seed: run
  `SOVRIUM_SEED_PASSWORD=… sovrium seed app.yaml` first, or every table opens empty
- **Settings navigation**: `config/pages/_settings-nav.yaml`, pulled into each settings page
  with `$ref`; each page names its own section as the default of its `section` query
  parameter, which is how the matching link is marked current
- **Static assets**: `public/` (served at the site root)

Every page, table and automation of app-starter is declared in its configuration and run by the Sovrium binary; there is no application code to change.

## Brand Commitments

The product is named app-starter.

## Evidence on Hand

Not recorded yet. Record real content, data and assets with their paths; do not invent customers, testimonials, figures or claims.
