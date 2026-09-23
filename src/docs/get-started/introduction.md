# Welcome to Sovrium

> What Sovrium is, why it exists, and how one configuration file becomes a complete web application.

Sovrium is a source-available, self-hosted platform that turns a single configuration file into a complete web application.

Install it with one command:

```bash
curl -fsSL https://sovrium.com/install | sh
```

**Beta.** Sovrium is in active beta. New-feature work is prioritized around the needs of Sovrium Partner clients, so the roadmap follows real projects — which means APIs, the configuration format, and features can still change, and breaking changes may land before v1.0.

## What is Sovrium?

Sovrium is a configuration-driven application platform. You describe your application in a YAML, JSON or TypeScript file — data models, authentication, pages, themes, analytics — and Sovrium turns it into a running, full-stack web application.

No boilerplate code, no framework setup, no build pipeline. Just one file that declares what your app should be.

```yaml
name: my-app

tables:
  - id: 1
    name: tasks
    fields:
      - id: 1
        name: title
        type: single-line-text
        required: true

auth:
  strategies:
    - type: emailAndPassword

design:
  colors:
    primary: '#3b82f6'
```

## Why Sovrium?

Most business applications share the same building blocks: data tables, user authentication, server-rendered pages, and a design system. Sovrium provides all of these out of the box, configured through a single schema.

- **No vendor lock-in.** Self-hosted on your infrastructure. Your data stays yours.
- **Configuration over code.** Declare what you need instead of writing boilerplate. Dozens of field types, dozens of component types, built-in auth.
- **Progressive complexity.** Start with just a name. Add tables, design, pages, auth, and analytics as your needs grow.
- **Source-available.** Business Source License 1.1. Free for internal use. Becomes Apache 2.0 in 2030.

## How it works

Write a configuration file, run one command, and get a working application:

1. Define your schema in YAML, JSON or TypeScript.
2. Run `sovrium start app.yaml`.
3. Get a full-stack app with data tables, auth, pages, and more.

## Next steps

Install Sovrium and build your first app in under five minutes.

- **Installation** — install Sovrium locally or deploy it to a managed host.
- **Quick Start** — build and run your first app from a single config file.
- **Core Concepts** — the anatomy of a Sovrium app.

## Explore the manual

Each section covers one building block of a Sovrium app: tables and their field types, pages and the components they are composed from, forms, authentication and access control, AI fields and agents, automations, file storage, and search.

## Getting help

Sovrium is source-available and developed in the open. If you run into an issue or have an idea for improvement, open an issue at `https://github.com/sovrium/sovrium/issues`.
