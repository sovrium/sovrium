# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Sovrium configuration (app.yaml + config/), rendered by the Sovrium binary on shadcn/ui base-nova; there is no hand-written front-end.

## Users

A small sales team: the reps who work contacts, companies, deals and tasks, and the founder or sales lead who also deletes records.

## Product Purpose

A sales CRM for a small team: pipeline board, contacts, tasks, assistant.

Kestrel CRM — a sales CRM for a small team. The pipeline board is the home page, with the
four figures a sales lead asks for; contacts and companies open in a drawer without leaving
their list; tasks sit on a calendar beside what is due next; and a records assistant reads
and edits all four tables.

## Capabilities and Constraints

- **Tables** (4): companies, contacts, deals, tasks
- **Pages** (6): pipeline (`/`), contacts, companies, tasks, assistant, sign-in
- **Automations** (3): deal-won-notification, and two library recipes (`library/recipe/`, each
  with its connection in `library/connection/`): record-to-slack posts each new deal to a
  Slack channel once `SLACK_BOT_TOKEN` is set, form-to-hubspot copies each contact added
  through the add-contact form into HubSpot once `HUBSPOT_ACCESS_TOKEN` is set
- **AI agents** (1): records-assistant
- **Singletons**: auth, design
- **Seed data**: `seed/` — two sign-in accounts, eight companies, ten contacts, thirteen
  deals and eleven tasks, dated relative to the day you seed
- **Static assets**: `public/` (served at the site root)

Every page, table and automation of kestrel-crm is declared in its configuration and run by the Sovrium binary; there is no application code to change.

## Brand Commitments

The product is named kestrel-crm. Copy addresses the reader as "you".

## Evidence on Hand

Not recorded yet. Record real content, data and assets with their paths; do not invent customers, testimonials, figures or claims.
