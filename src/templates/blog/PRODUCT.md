# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Sovrium configuration (app.yaml + config/), rendered by the Sovrium binary on shadcn/ui base-nova; there is no hand-written front-end.

## Users

A small team that publishes essays: the editors who write, schedule and moderate behind `/admin`, and the readers, who never sign in.

## Product Purpose

A publication: essays with covers, moderated comments, an RSS feed, and a desk that
schedules posts.

Field Notes — a fictional publication a small studio owns: an index of essays with their
covers, one page per essay with its byline, its body and the comments the editor approved,
an RSS feed, and a desk behind `/admin` where the editor schedules posts, approves comments
and asks an assistant for drafts. Readers never sign in; nobody can open an account.

## Capabilities and Constraints

- **Tables** (5): authors, tags, posts (Draft → Scheduled → Published), comments (Held until
  approved; a row-level rule shows readers the Approved ones only), subscribers (the
  newsletter list, admin only)
- **Pages** (10): essays (`/`), essay (`/blog/:slug`, one page per published post, feed at
  `/feed.xml`), not-found (`/404`), and the desk — posts, post edit, comments, tags, authors,
  assistant, sign-in
- **Forms** (3): comment (public, honeypot; arrives Held), new-post (the desk's dialog),
  newsletter (public; the library sign-up block on `/` posts to it)
- **Automations** (5): schedule-on-date (a draft given a date is Scheduled),
  publish-scheduled (every hour, a scheduled post whose date has come is Published),
  stamp-new-comment (a new comment is dated when it arrives), triage-comment (a form trigger
  and an `ai` classify step labelling each new comment for the desk), and form-to-brevo — a
  library recipe (`library/recipe/`, with its `library/connection/brevo.yaml`) sending each
  newsletter address to Brevo once `BREVO_API_KEY` is set
- **AI agents** (1): blog-editor (every write waits for the editor's approval)
- **Library block**: `library/block/newsletter-inline.yaml`, the sign-up under the essays
- **Singletons**: design (roomy public pages, cozy desk), auth (sign-up closed), env
- **Seed**: `seed/` — seven posts with covers from `seed/assets/`, three authors, six tags,
  two comments, and the editor's account

Every page, table and automation of field-notes is declared in its configuration and run by the Sovrium binary; there is no application code to change.

## Brand Commitments

The product is named field-notes. Copy addresses the reader as "you".

## Evidence on Hand

Not recorded yet. Record real content, data and assets with their paths; do not invent customers, testimonials, figures or claims.
