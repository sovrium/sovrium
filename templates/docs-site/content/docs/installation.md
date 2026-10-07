---
title: Installation
description: Install the CLI, scaffold this template, and serve it locally.
category: getting-started
order: 2
updated: 2026-09-11
---

# Installation

Install the CLI, scaffold this template, and serve it locally.

## Install the CLI

Run the install script on macOS or Linux:

```bash
curl -fsSL https://sovrium.com/install | sh
```

Or install it with Homebrew:

```bash
brew install sovrium/tap/sovrium
```

Or pull the container image:

```bash
docker pull ghcr.io/sovrium/sovrium:latest
```

## Scaffold this template

```bash
sovrium init my-docs --template docs-site
cd my-docs
sovrium start app.yaml
```

Your docs are now served at `http://localhost:3000`, with this page at
`/docs/installation`.

::: callout type="note"
**One binary.**

The CLI is a single file with no runtime to install. The
container image carries the same binary.
:::

## Verify

```bash
sovrium validate app.yaml
```

A clean run prints `Valid configuration: docs-site`.

::: callout type="tip"
**Validate before you commit.**

`sovrium validate` checks every page and the
design file without starting the server, so a typo fails in a second rather
than on the live site.
:::
