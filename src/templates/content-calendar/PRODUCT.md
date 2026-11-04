# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Sovrium configuration (app.yaml + config/), rendered by the Sovrium binary on shadcn/ui base-nova; there is no hand-written front-end.

## Users

A small marketing team that plans what it publishes: the people who plan and write each piece, and the lead who approves what leaves Review.

## Product Purpose

A content calendar: every piece on a month coloured by channel, a pipeline with the lead's approval, campaigns and a Monday digest.

Loomwork Content — a small software company's content calendar. Every piece, from idea to
published, sits on one month coloured by its channel, on a board by status, and in a grid
grouped by campaign. A piece sent to Review waits for the lead's approval before it is
scheduled, and every Monday the team gets the week's pieces by email.

## Capabilities and Constraints

- **Tables** (2): campaigns (a window, a budget and a status), content (the pieces; `flag`
  marks a late one, `campaign_name` reads the campaign's name for the filter bars)
- **Forms** (1): new-piece (opened in the New piece dialog on every page)
- **Pages** (4): calendar (`/`), pipeline, content (`/content`, All content), sign-in
- **Automations** (5): own-new-piece, approve-for-scheduling, monday-digest (a cron),
  mint-tracked-link (a `link` create step writing the short link on the piece), and
  record-to-linkedin-post — a library recipe (`library/recipe/`, with its
  `library/connection/linkedin.yaml`) posting a LinkedIn piece when it is marked Published,
  once the LinkedIn variables are set
- **Singletons**: auth, design, env
- **Seed data**: `seed/` — two sign-in accounts, four campaigns and fifteen pieces, dated
  relative to the day you seed, with one thumbnail in `seed/assets/`
- **Static assets**: `public/` (served at the site root)

Every page, table and automation of loomwork-content is declared in its configuration and run by the Sovrium binary; there is no application code to change.

## Brand Commitments

The product is named loomwork-content. Copy addresses the reader as "you".

## Evidence on Hand

Not recorded yet. Record real content, data and assets with their paths; do not invent customers, testimonials, figures or claims.
