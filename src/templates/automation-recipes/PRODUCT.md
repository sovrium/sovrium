# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Sovrium configuration (app.yaml + config/), rendered by the Sovrium binary on shadcn/ui base-nova; there is no hand-written front-end.

## Users

A team learning how automations are declared and run inside an app. Visitors read the recipes on the public page; behind sign-in, members read the runs and the leads, and an admin may also delete them.

## Product Purpose

Automations that run in your own app, with every run kept.

Kerlo Automations — six automations running inside the app they serve, for a small studio's
lead intake. The public page (`/`) shows each recipe as its trigger, its steps and the lines
of configuration that declare it. Behind sign-in, Activity is every run with its outcome and
one line of why — four figures above it, and a run opens in a drawer with its attempts and
its error — and Leads is the leads the recipes wrote.

## Capabilities and Constraints

- **Tables** (2): leads, activity_log
- **Pages** (4): activity, leads, home (`/`, public), sign-in
- **Automations** (7): capture-lead-from-webhook, log-new-lead, daily-digest,
  alert-on-failure, review-recent-leads (manual trigger, a branch with a stop step, a call),
  score-leads (automation-call trigger, a loop, a `$ref` step, a return), and
  record-to-mistral-summary — a library recipe (`library/recipe/`, with its
  `library/connection/mistral.yaml`) summarising a lead's message once `MISTRAL_API_KEY` is set
- **Reusable actions** (1): log-lead-review, under `actions:` in `app.yaml`
- **Singletons**: auth, design, env (`LEADS_WEBHOOK_TOKEN`, required to boot)
- **Seed data**: `seed/` — two sign-in accounts, eight leads and a week of runs, dated
  relative to the moment you seed
- **Static assets**: `public/` (served at the site root)

Every page, table and automation of kerlo-automations is declared in its configuration and run by the Sovrium binary; there is no application code to change.

## Brand Commitments

The product is named kerlo-automations. Copy addresses the reader as "you".

## Evidence on Hand

Not recorded yet. Record real content, data and assets with their paths; do not invent customers, testimonials, figures or claims.
