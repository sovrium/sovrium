# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Sovrium configuration (app.yaml + config/), rendered by the Sovrium binary on shadcn/ui base-nova; there is no hand-written front-end.

## Users

A company that needs a marketing website and replaces the placeholder copy with its own. Visitors never sign in; the owner reads the contact messages in the admin.

## Product Purpose

A marketing website built from every marketing block of the library.

Marketing site — a website made entirely of the library's marketing blocks: a home page, a
features page, a product tour, pricing, an about page, a blog and a single article, a
long-form guide, a contact page and two pages for lost visitors. Every piece of copy in square brackets is a placeholder to replace
with your own.

## Capabilities and Constraints

- **Tables** (4): posts (the blog sections read it), orders (the live figures read it, through a
  public view), messages (the contact form writes it; only the owner reads it),
  subscribers (the newsletter form writes it; only the owner reads it)
- **Forms** (2): contact and newsletter — the contact and newsletter blocks post to them
- **Languages**: English and French, keys in `config/languages.yaml`, cited as `$t:<key>`
- **Auth**: one owner from `AUTH_ADMIN_*`, no sign-up
- **Pages** (11): home (`/`), features, product, pricing, about, blog, article, guide, contact, moved, 404
- **Library blocks** (39): under `library/block/`, each starting with a `sovrium-library:`
  line naming the entry and version it was installed from
- **Seed data**: `seed/` — four blog posts and a few orders
- **Static assets**: `public/` (served at the site root)

Every page, table and automation of marketing-site is declared in its configuration and run by the Sovrium binary; there is no application code to change.

## Brand Commitments

The product is named marketing-site.

## Evidence on Hand

Not recorded yet. Record real content, data and assets with their paths; do not invent customers, testimonials, figures or claims.
