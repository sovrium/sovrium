# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Sovrium configuration (app.yaml + config/), rendered by the Sovrium binary on shadcn/ui base-nova; there is no hand-written front-end.

## Users

A small firm that lends out its equipment: the people who hold kit, hand it over and take it back, and the office manager who keeps the register.

## Product Purpose

An asset register for a small firm: what it owns, who holds it, where it is, what is due back.

Arden Assets — the asset register of a small design studio. The Register is the home page:
everything the firm owns grouped by category, with each asset's tag, holder and place, four
figures above it, and one word beside the assets that need someone (missing at the last
count, due back today or overdue, a warranty ending). An asset opens in a drawer with its
check-outs and its history. Lifecycle is the board by stage, Gallery the assets in service as
cards, Locations the places they sit.

## Capabilities and Constraints

- **Tables** (4): locations, assets, check_outs, asset_events
- **Pages** (5): register (`/`), lifecycle, gallery, locations, sign-in
- **Automations** (2): register-export (the register to a dated CSV in storage on the first
  of each month, with `file.generateCsv`), and record-to-teams-channel — a library recipe
  (`library/recipe/`, with its `library/connection/microsoft-365.yaml`) posting each asset
  event to a Teams channel once the Microsoft keys are set
- **Singletons**: auth, design
- **Seed data**: `seed/` — five sign-in accounts, five locations, fourteen assets, their
  check-outs and their history, dated relative to the day you seed
- **Static assets**: `public/` (served at the site root)

Every page, table and automation of arden-assets is declared in its configuration and run by the Sovrium binary; there is no application code to change.

## Brand Commitments

The product is named arden-assets. Copy addresses the reader as "you".

## Evidence on Hand

Not recorded yet. Record real content, data and assets with their paths; do not invent customers, testimonials, figures or claims.
