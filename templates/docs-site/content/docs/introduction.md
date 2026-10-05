---
title: Introduction
description: What this site is, and how a markdown file becomes a page.
category: getting-started
order: 1
updated: 2026-09-02
---

# Introduction

This site is a folder of markdown files. Every page you read here is a file
under `content/docs/`, and the sidebar, the outline, previous and next, and
the highlighted code all come from those files and one page of configuration.

## How a file becomes a page

`config/pages/docs.yaml` declares a content collection. At start, Sovrium
reads every file in the folder and serves each one at its own address:

| File                                   | Page                         |
| -------------------------------------- | ---------------------------- |
| `content/docs/introduction.md`         | `/docs/introduction`         |
| `content/docs/quick-start.md`          | `/docs/quick-start`          |
| `content/docs/guides/configuration.md` | `/docs/guides/configuration` |

A folder stays in the address, so `guides/` is both a folder on disk and a part
of the URL. `/docs` itself opens this page.

![Three markdown files on the left; on the right, the sidebar they produce — Getting started with Introduction and Quick Start, Guides with Configuration.](/docs/files-to-pages.avif)

## What the front matter does

Every file opens with a short block of front matter. Each key has one job:

- `title` — the page's name in the sidebar and the browser tab.
- `description` — the summary search engines and link previews show.
- `category` — the sidebar section the page sits in.
- `order` — its place in the reading order, across sections.
- `updated` — the date printed under the page as "Last updated".

## What you can write

The body is GitHub-flavoured markdown: headings, tables, lists, images, and
fenced code highlighted on the server. Three kinds of callout set a sentence
apart — a note, a tip and a warning. The [Quick Start](/docs/quick-start) adds
a page in three steps.
