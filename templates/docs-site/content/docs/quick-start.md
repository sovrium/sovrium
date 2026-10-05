---
title: Quick Start
description: Add a page to the docs in three steps.
category: getting-started
order: 3
updated: 2026-09-18
---

# Quick Start

Adding a page is adding a file. There is no route table to edit and no sidebar
to maintain.

## 1. Create a file

Add a markdown file anywhere under `content/docs/`. Its path becomes its URL:

```bash
touch content/docs/guides/theming.md   # → /docs/guides/theming
```

## 2. Add frontmatter

The frontmatter wires the file into the sidebar and the order:

```yaml title="content/docs/guides/theming.md"
---
title: Theming
description: Make the docs match your brand.
category: guides # sidebar group
order: 6 # position in the group
---
```

## 3. Restart

```bash
sovrium start app.yaml
```

::: callout type="note"
**The folder is the source of truth.** No file is registered by hand. Delete a
file and its route disappears on the next start.
:::

::: callout type="warning"
**Draft pages stay hidden.** A page with `draft: true` is left out of the
sidebar and the build.
:::
