# Welcome to Sovrium

> What Sovrium is, why it exists, and how one configuration file becomes a running web application.

Sovrium is a source-available, self-hosted platform that turns a single configuration file into a running web application.

Install it with one command:

```bash
curl -fsSL https://sovrium.com/install | sh
```

**Beta.** Sovrium is in active beta. New-feature work is prioritized around the needs of Sovrium Partner clients, so the roadmap follows real projects. APIs, the configuration format and features can still change, and breaking changes may land before v1.0.

## What is Sovrium?

Sovrium is a configuration-driven application platform. You describe your application (data models, authentication, pages, themes, analytics) in a YAML, JSON or TypeScript file, and Sovrium turns it into a running, full-stack web application.

You write no application code and set up no framework or build step: the file declares what the app is, and Sovrium runs it.

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

Most business applications share the same building blocks: data tables, user authentication, server-rendered pages, and a design system. Sovrium ships all four and configures them from a single schema.

It runs on your own infrastructure, so the data sits in a database you control instead of a vendor's.

You declare what you need and Sovrium builds it: dozens of field types, dozens of component types and authentication are part of the binary.

An app can start as nothing but a name. You add tables, design, pages, auth and analytics as the app needs them.

The source is available under the Business Source License 1.1. It is free for internal and non-commercial use, and it prevents offering Sovrium as a competing hosted service. The licence terms are in `LICENSE.md`.

## How it works

Write a configuration file, run one command, and get a working application:

1. Define your schema in YAML, JSON or TypeScript.
2. Run `sovrium start app.yaml`.
3. Open the running app, with its data tables, sign-in and pages.

## Next steps

Install Sovrium and build your first app in under five minutes.

- **Installation**: install Sovrium locally or deploy it to a managed host.
- **Quick Start**: build and run your first app from a single config file.
- **Core Concepts**: the anatomy of a Sovrium app.

## Explore the manual

Each section covers one building block of a Sovrium app: tables and their field types, pages and the components they are composed from, forms, authentication and access control, AI fields and agents, automations, file storage, and search.

## Getting help

Sovrium is source-available and developed in the open. If you run into an issue or have an idea for improvement, open an issue at `https://github.com/sovrium/sovrium/issues`.
