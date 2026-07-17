---
title: Installation
description: Install the Sovrium CLI and scaffold this docs template.
category: Getting Started
order: 2
draft: false
---

# Installation

Sovrium ships as a standalone binary. Pick whichever path fits your machine.

## Install the CLI

```bash
# Install script (macOS / Linux)
curl -fsSL https://sovrium.com/install | sh

# Homebrew
brew install sovrium/tap/sovrium

# Docker
docker pull ghcr.io/sovrium/sovrium:latest
```

## Scaffold this template

```bash
sovrium init my-docs --template docs-site
cd my-docs
sovrium start app.yaml
```

Your docs are now served at `http://localhost:3000`, with this very page at
`/docs/installation`.

## Project layout

```text
my-docs/
├── app.yaml                 # entry point
├── config/
│   ├── theme.yaml           # colors, fonts, codeBlock (Shiki) theme
│   └── pages/
│       ├── home.yaml        # inline-markdown landing
│       └── docs.yaml        # contentDir collection
└── content/
    └── docs/                # ← your markdown lives here
        ├── introduction.md
        ├── installation.md
        ├── quick-start.md
        └── guides/
            ├── configuration.md
            └── deployment.md
```

::: callout
Zero configuration: this template has no database, auth, AI, or email. Copy
`.env.example` to `.env` only if you want to override a default.
:::

## Verify

```bash
# Validate the config without starting the server
sovrium validate app.yaml
```

A clean run prints `Valid configuration: docs-site`.
