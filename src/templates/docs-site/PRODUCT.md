# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Sovrium configuration (app.yaml + config/), rendered by the Sovrium binary on shadcn/ui base-nova; there is no hand-written front-end.

## Users

A project that publishes its documentation as markdown files in its repository. Every reader is anonymous; there is no sign-in.

## Product Purpose

A documentation website from markdown files: a sidebar in sections, an outline, last-updated dates, an edit link and highlighted code.

Docs — a documentation website whose every page is a markdown file in the repository. A
landing page with the one command that starts it and three ways in; behind it the
documentation itself: a sidebar of sections, the page with its outline, the date it was last
updated, a link to edit its source, previous and next across sections, typed callouts and
highlighted code. Every page is public; there is no database content and no sign-in.

## Capabilities and Constraints

- **Pages** (3): docs (`/docs/:path*`, one route per file under `content/docs/`, `/docs`
  itself is `introduction.md`), home (`/`), not-found (`/404`, served for any address that
  answers nothing)
- **Markdown content**: `content/docs/` — two sections, `getting-started` at the root and
  `guides/` in a folder of its own; each page's frontmatter carries `title`, `description`,
  `category`, `order` and `updated`. `guides/theming.md` is a draft, left out until its
  `draft: true` line is removed
- **Singletons**: design
- **Static assets**: `public/` (served at the site root; the introduction's picture is in
  `public/docs/`)

Every page, table and automation of docs-site is declared in its configuration and run by the Sovrium binary; there is no application code to change.

## Brand Commitments

The product is named docs-site. Copy addresses the reader as "you".

## Evidence on Hand

Not recorded yet. Record real content, data and assets with their paths; do not invent customers, testimonials, figures or claims.
