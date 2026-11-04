# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Sovrium configuration (app.yaml + config/), rendered by the Sovrium binary on shadcn/ui base-nova; there is no hand-written front-end.

## Users

Someone launching a product who needs one page to present it in English and French. Visitors never sign in; the owner reads the demo requests in the admin.

## Product Purpose

A bilingual product landing page with a demo request the owner reads in the admin.

Tablée — the landing page of a fictional booking product for independent restaurants, in
English and in French: one sentence, the product itself, three things it does, three steps,
and a demo request the owner reads in the admin. Visitors never sign in; nobody can open an
account.

## Capabilities and Constraints

- **Pages** (1): home (`/`, also `/en/` and `/fr/`) — its body is `_body.yaml`; the sharing
  card is a `$t:` key, so each language shares with its own
- **Tables** (1): demo_requests (written by the form only; read by an admin only)
- **Forms** (1): demo-request (public, honeypot; confirms with the address typed)
- **Automations** (1): form-to-pipedrive-lead — a library recipe (`library/recipe/`, with its
  `library/connection/pipedrive.yaml`) turning each demo request into a Pipedrive lead once
  `PIPEDRIVE_API_TOKEN` is set
- **Components** (3): feature-card, step-card, language-switcher
- **Singletons**: design, languages (every sentence is a `$t:` key), auth (sign-up closed)
- **Static assets**: `public/` — `favicon.svg`, `og-en.png`, `og-fr.png`

Every page, table and automation of tablee is declared in its configuration and run by the Sovrium binary; there is no application code to change.

## Brand Commitments

The product is named tablee. Copy addresses the reader as "you".

## Evidence on Hand

Not recorded yet. Record real content, data and assets with their paths; do not invent customers, testimonials, figures or claims.
