---
title: Configuration
description: Theme tokens, the Shiki code-block theme, and collection options.
category: Guides
order: 4
draft: false
---

# Configuration

Three knobs shape the site: the theme, the code-block highlighter, and the
content-directory collection.

## Theme tokens

Colors, fonts, radii, and shadows live in `config/theme.yaml`. Token names become
both Tailwind utilities and CSS variables, so the markdown layouts pick them up
automatically.

```yaml
colors:
  primary: '#6d28d9'
  primary-light: '#ede9fe'
  text: '#1e1b2e'
fonts:
  sans:
    family: Inter
    size: 16px
```

## Code highlighting

Fenced code is highlighted server-side by Shiki, themed by one token:

```yaml
theme:
  codeBlock:
    theme: github-dark
```

Shiki emits class / CSS-variable markup (never inline `style`), so highlighted
code survives the HTML sanitizer. Unknown languages fall back to a plain block.

## Collection options

The `docs.yaml` page configures how the folder is scanned and navigated:

| Option          | Effect                                               |
| --------------- | ---------------------------------------------------- |
| `slugFrom`      | `filename` (flat) or `filepath` (nested URLs)        |
| `filter.draft`  | `false` hides files marked `draft: true`             |
| `sort`          | Orders routes and the sidebar by a frontmatter field |
| `nav.groupBy`   | Buckets the sidebar by a frontmatter field           |
| `nav.labelFrom` | Chooses which frontmatter field labels each link     |

> Change `sort.field` to `title` and the sidebar reorders alphabetically — no
> code, just config.

::: callout
Want a light site? Set `codeBlock.theme: github-light` and swap the palette in
`theme.yaml`. The layouts re-theme themselves from the tokens.
:::
