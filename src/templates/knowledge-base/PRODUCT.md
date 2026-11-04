# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Sovrium configuration (app.yaml + config/), rendered by the Sovrium binary on shadcn/ui base-nova; there is no hand-written front-end.

## Users

A company that keeps its handbook private: every colleague, who reads it and asks its assistant, the managers, who also read their own section, and the admin who owns it.

## Product Purpose

A private company handbook: markdown articles in sections, a managers' section, a search and an assistant — behind sign-in.

Corvel handbook — a private company handbook. A public welcome page that names the
sections, a sign-in, and behind it the handbook itself: a sidebar of sections, the article
with its outline and the date it was last updated, previous and next across sections. A
managers' section only managers can open, a search box that answers with what the reader may
read, and an assistant that answers from the handbook.

## Capabilities and Constraints

- **Pages** (6): kb (`/kb/:path*`, one route per article under `content/kb/`, `/kb` itself is
  `start.md`), kb-managers (`/kb/managers/:path*`, managers and the admin only), assistant,
  home (`/`), sign-in, not-found (`/404`, the library block
  `library/block/not-found-with-links.yaml` pointed at the handbook)
- **Agents** (1): handbook-assistant (reads the five articles everyone may read)
- **Markdown content**: `content/kb/` — the handbook, one folder per section; each article's
  frontmatter carries `title`, `category`, `order` and `updated`. `content/kb-managers/` —
  the managers' section, served by its own page
- **Singletons**: auth, design
- **Seed data**: `seed/users.yaml` — the two demo accounts
- **Static assets**: `public/` (served at the site root; the laptop article's image is in
  `public/handbook/`)

Every page, table and automation of corvel-handbook is declared in its configuration and run by the Sovrium binary; there is no application code to change.

## Brand Commitments

The product is named corvel-handbook. Copy addresses the reader as "you".

## Evidence on Hand

Not recorded yet. Record real content, data and assets with their paths; do not invent customers, testimonials, figures or claims.
