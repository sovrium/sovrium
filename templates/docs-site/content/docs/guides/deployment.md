---
title: Deployment
description: Build a static bundle or run the server, and ship it anywhere.
category: Guides
order: 5
draft: false
---

# Deployment

A docs site is public and stateless, so you can ship it as static files or run
it as a long-lived server. Both render the same markdown.

## Static build

Render every page to HTML and host the folder on any static host (Netlify,
Cloudflare Pages, S3, GitHub Pages):

```bash
sovrium build app.yaml --output ./dist
# ./dist now holds the HTML for every /docs/* route plus assets
```

## Run the server

```bash
PORT=3000 sovrium start app.yaml
```

## Docker

```dockerfile
FROM ghcr.io/sovrium/sovrium:latest
COPY . /app
WORKDIR /app
CMD ["start", "app.yaml"]
```

## Editing workflow

Because content is files, the authoring loop is just Git:

1. Add or edit a `.md` file in `content/docs/`.
2. Set `draft: true` in frontmatter to hide a work-in-progress page.
3. Commit. The next build (or a dev restart) picks it up automatically.

::: callout
Frugal by default: no database, no AI, no email means no secrets to manage and a
tiny footprint. The static build is just HTML, CSS, and highlighted code.
:::
