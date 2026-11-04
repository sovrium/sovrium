# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Sovrium configuration (app.yaml + config/), rendered by the Sovrium binary on shadcn/ui base-nova; there is no hand-written front-end.

## Users

A small software company that answers its customers: requesters who write in from a public form with no account, the agents who work the queue, and the team lead who also reads the reports.

## Product Purpose

A small team's helpdesk: a public ticket form, one queue, and a rating once it is solved.

Tallyline Support — a small software company's helpdesk. Requesters write in from a public form
with a screenshot and no account; the team works every ticket from one queue by status, with who
holds it; a ticket opens over the grid with its conversation; the requester rates the answer once
it is resolved.

## Capabilities and Constraints

- **Tables** (3): tickets, ticket_replies (the conversation of a ticket), ratings
- **Forms** (2): contact-support (rendered on `/`), rate-answer (rendered on `/rate`)
- **Pages** (8): triage (`/triage`, the Queue), tickets, ticket (`/tickets/:id`, with the
  internal notes), reports (admin), home (`/`, public), thanks, rate (public), sign-in
- **Automations** (5): when-a-ticket-arrives, when-resolved, collect-ticket-notes (a comment
  trigger filling a digest), morning-notes-digest (a weekday cron releasing it), and
  record-to-linear-issue — a library recipe (`library/recipe/`, with its
  `library/connection/linear.yaml`) filing each bug report in Linear once `LINEAR_API_KEY`
  and `LINEAR_TEAM_ID` are set
- **Library block**: `library/block/record-comments.yaml`, the notes thread on the ticket page
- **Singletons**: auth, design, env
- **Seed data**: `seed/` — two sign-in accounts, fourteen tickets, three conversations and
  three ratings, dated relative to the day you seed
- **Static assets**: `public/` (served at the site root)

Every page, table and automation of tallyline-support is declared in its configuration and run by the Sovrium binary; there is no application code to change.

## Brand Commitments

The product is named tallyline-support. Copy addresses the reader as "you".

## Evidence on Hand

Not recorded yet. Record real content, data and assets with their paths; do not invent customers, testimonials, figures or claims.
