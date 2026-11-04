# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Sovrium configuration (app.yaml), rendered by the Sovrium binary on shadcn/ui base-nova; there is no hand-written front-end.

## Users

Someone who has just run `sovrium init` and wants to see an app start and change. There are no tables and no sign-in.

## Product Purpose

The one-page starter. Where every app begins.

Hello World — the first page after `sovrium init`. One page at `/` says the app runs, shows
the lines of `app.yaml` that make it, and links the documentation and the templates; a page
at `/404` answers any address that has no page yet, with the way back. No tables, no
sign-in.

## Capabilities and Constraints

- **Pages** (2): home (`/`), not-found (`/404`, served for any address that answers nothing)
- **Singletons**: design (inline: twelve colour roles per scheme, `colorScheme: system`)
- **Static assets**: `public/` (served at the site root)

Every page, table and automation of my-app is declared in its configuration and run by the Sovrium binary; there is no application code to change.

## Brand Commitments

The product is named my-app. Copy addresses the reader as "you".

## Evidence on Hand

Not recorded yet. Record real content, data and assets with their paths; do not invent customers, testimonials, figures or claims.
