# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Sovrium configuration (app.yaml + config/), rendered by the Sovrium binary on shadcn/ui base-nova; there is no hand-written front-end.

## Users

A small company that runs sales, delivery, support and its team in one app: the people on the team, who create and edit records in every module, and whoever runs operations, who also deletes them and decides on time off.

## Product Purpose

A small company's sales, delivery, support and team in one app, around one list of clients.

Orrin OS — a small company's sales, delivery, support and team in one app. Home shows one figure
from every module and what waits on you across all four; the pipeline holds deals by stage; a
client opens in a drawer with its deals, projects and tickets; projects carry their tasks;
tickets sit on a board by status; and the team page shows who is away and which time off waits
on a decision.

## Capabilities and Constraints

- **Tables** (9): companies, contacts, deals, projects, project_tasks, tickets, employees,
  time_off_requests, customer_invoices (admin-only, filled by the Pennylane recipe)
- **Pages** (8): home (`/`), sales, companies, delivery, support, people, assistant, sign-in
- **Automations** (4): open-project-on-won-deal (stops with a `flow` stop when the deal's
  project is already open), notify-contact-on-resolved-ticket, approve-time-off, and
  pennylane-invoices-to-table — a library recipe (`library/recipe/`, with its
  `library/connection/pennylane.yaml`) filing each morning's new invoices once
  `PENNYLANE_API_TOKEN` is set
- **AI agents** (1): ops-assistant
- **Singletons**: auth, design
- **Seed data**: `seed/` — nine sign-in accounts, six clients, nine deals, six projects, eight
  tasks, eight tickets and five time-off requests, dated relative to the day you seed
- **Static assets**: `public/` (served at the site root)

Every page, table and automation of orrin-os is declared in its configuration and run by the Sovrium binary; there is no application code to change.

## Brand Commitments

The product is named orrin-os. Copy addresses the reader as "you".

## Evidence on Hand

Not recorded yet. Record real content, data and assets with their paths; do not invent customers, testimonials, figures or claims.
