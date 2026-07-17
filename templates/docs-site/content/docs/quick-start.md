---
title: Quick Start
description: Add your first documentation page in three steps.
category: Getting Started
order: 3
draft: false
---

# Quick Start

Adding a page is adding a file. There is no route table to edit and no sidebar
to maintain — the collection discovers everything from `content/docs/`.

## 1. Create a file

Add a new markdown file anywhere under `content/docs/`. Its path becomes its URL:

```bash
touch content/docs/guides/theming.md   # → /docs/guides/theming
```

## 2. Add frontmatter

The frontmatter wires the file into the sidebar and ordering:

```yaml
---
title: Theming
description: Make the docs match your brand.
category: Guides # sidebar group
order: 6 # position within the group
draft: false # set true to hide it
---
```

## 3. Write the body

Everything below the frontmatter is GitHub-Flavored Markdown: headings, tables,
fenced code (highlighted by Shiki), blockquotes, and `::: callout :::`
directives that render as themed components.

For example, a `Theming` page body might look like this:

````markdown
# Theming

Set a single Shiki theme for every fenced code block:

```yaml
theme:
  codeBlock:
    theme: github-light
```

::: callout
Palette and font tokens live in `theme.yaml`. See the
[Configuration guide](/docs/configuration) for the full list.
:::
````

The fenced block is highlighted server-side, and the `::: callout :::` directive
renders as a themed alert — no component wiring required.

## 4. Restart

```bash
sovrium start app.yaml
```

Sovrium re-scans `content/docs/` on start, so the new page, its sidebar entry,
and its prev/next links all appear automatically.

::: callout
No file is ever "registered" by hand — the folder is the source of truth. Delete
a file and its route disappears on the next start.
:::
