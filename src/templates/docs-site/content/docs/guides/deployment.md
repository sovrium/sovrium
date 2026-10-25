---
title: Deployment
description: Publish the site as static files, a server or a container.
category: guides
order: 5
updated: 2026-09-16
---

# Deployment

A documentation site is public and keeps no data, so it can ship as static
files or run as a server. Both render the same markdown.

## A static build

Render every page to HTML, then upload the folder to any static host:

```bash
sovrium build app.yaml
```

The pages land in `./dist`. Set `SOVRIUM_OUTPUT_DIR` to write them elsewhere,
and `SOVRIUM_BASE_URL` so the sitemap carries your address.

## The server

```bash
PORT=3000 sovrium start app.yaml
```

The server reads `content/docs/` at start, so a restart publishes an edit.

## A container

```dockerfile title="Dockerfile"
FROM ghcr.io/sovrium/sovrium:latest
COPY . /app
WORKDIR /app
CMD ["start", "app.yaml"]
```

## The editing loop

1. Edit a file under `content/docs/`, or follow "Edit this page".
2. Set `draft: true` to keep a page out while you write it.
3. Commit. The next build or restart publishes it, with its new date.

::: callout type="warning"
**Set `BASE_URL` in production.**

Without it, the sitemap and the links in
link previews point at `localhost`.
:::
