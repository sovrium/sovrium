---
title: Introduction
description: What this docs site is and how a markdown file becomes a route.
category: Getting Started
order: 1
draft: false
---

# Introduction

Welcome to the Sovrium documentation starter. This whole section is generated
from the `.md` files in `content/docs/` — there is no per-page configuration to
maintain. Add a file, get a route.

## How a file becomes a route

The `config/pages/docs.yaml` page declares a **content directory collection**.
At startup Sovrium scans the folder, reads each file's frontmatter, and
registers one route per file:

| File                                | Route                     |
| ----------------------------------- | ------------------------- |
| `content/docs/introduction.md`      | `/docs/introduction`      |
| `content/docs/installation.md`      | `/docs/installation`      |
| `content/docs/guides/deployment.md` | `/docs/guides/deployment` |

Because `slugFrom: filepath`, nested folders are preserved in the URL — so the
folder layout _is_ the navigation.

## Frontmatter drives everything

Every file opens with a YAML frontmatter block. These keys do real work:

- `title` — the sidebar label for this page (`nav.labelFrom: title`)
- `description` — a short summary of the page
- `category` — the sidebar group heading (`nav.groupBy: category`)
- `order` — the position within the section (`sort.field: order`)
- `draft` — set `true` to exclude a file from routes and the sidebar

> The sidebar, the table of contents, and the previous/next links at the bottom
> of this page are all derived automatically. You never hand-write a nav list.

## What you can write

The body is GitHub-Flavored Markdown: tables, ordered and nested lists,
blockquotes, autolinks like https://sovrium.com, images, and fenced code that is
syntax-highlighted server-side.

::: callout
Ready to run it locally? Head to **Installation** using the link at the bottom of
this page — the prev/next chrome is generated from the collection order.
:::
