---
title: Configuration
description: Design tokens, code highlighting and the collection options.
category: guides
order: 4
updated: 2026-09-15
---

# Configuration

Three files shape the site: `config/design.yaml` for how it looks,
`config/pages/docs.yaml` for how the folder is read, and the markdown itself.

## Design tokens

Colours, type, corners and spacing live in `config/design.yaml`. A role key
repaints every page at once — the links, the sidebar, the callouts:

```yaml title="config/design.yaml"
colors:
  primary: oklch(0.52 0.16 175)
darkColors:
  primary: oklch(0.78 0.12 175)
```

`colorScheme: system` follows the reader's light or dark preference.

## Code highlighting

Every fenced block is highlighted on the server with one Shiki theme:

```yaml title="config/design.yaml"
codeBlock:
  theme: github-dark
```

## Collection options

`config/pages/docs.yaml` tells Sovrium how to read `content/docs/`:

| Option            | What it does                                                  |
| ----------------- | ------------------------------------------------------------- |
| `slugFrom`        | `filepath` keeps folders in the URL; `filename` flattens them |
| `index`           | The page `/docs` opens — here, `introduction`                 |
| `sort`            | The reading order, from a front matter key                    |
| `nav.groupBy`     | The front matter key that sections the sidebar                |
| `nav.groupLabels` | How each section is spelled in the sidebar                    |
| `editUrl`         | Where "Edit this page" points, with `{path}` for the file     |
| `filter`          | Which files are left out — `draft: true` by default here      |

::: callout type="tip"
**Point "Edit this page" at your repository.** Replace the address in
`editUrl` with your own, and every page links to its source file.
:::
