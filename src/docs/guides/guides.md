# Guides

> Task-based guides for building with Sovrium — each answers one question with a complete, runnable config.

Practical, task-based walkthroughs. Each answers one question with a complete, runnable config you can copy, run and adapt. New to Sovrium? Start with **Quick Start**, then come back here.

## Deploy

Get a Sovrium app into production.

- **Deploy with Docker** — run the official container.
- **Deploy on a VPS with systemd and Caddy** — the binary as a service, with automatic HTTPS.
- **Deploy on Scalingo** — git-push deploy with a managed database.
- **Deploy with Docker Compose and PostgreSQL** — app and database as one stack.

## Migrate to Sovrium

Bring an existing tool in-house — self-hosted and config-as-code. Each guide walks through `sovrium import`, which converts the tool you are leaving into Sovrium config and seed files.

- **Migrate from Airtable** — import a base with its links, formulas and files.
- **Migrate from Notion** — import a database with its relations and people.
- **Migrate from Zapier** — import Zapier Tables and Zaps, then finish and switch on each automation.
- **Migrate from Make** — convert scenarios into automations you switch on one at a time.
- **Migrate from n8n** — convert workflows into automations you switch on one at a time.
- **Migrate from Typeform** — import a form with its logic and its responses.

## Integrations

Wire Sovrium to the services you run.

- **Connect to PostgreSQL** — switch off SQLite with one variable.
- **Run AI locally with Ollama** — private, key-free inference.
- **Store files in S3-compatible storage** — durable object storage.
- **Send transactional email** — auth and automation email over SMTP.
- **Connect an MCP client** — expose your app to an AI client.

## Build with Sovrium

- **Build a CRM** — from the template, or a minimal config you grow.
- **Start from a template** — scaffold a working app with `sovrium init`.

## Operations

Run a Sovrium app for the long haul.

- **Back up and restore SQLite** — a consistent one-file backup.
- **Upgrade and rollback** — move versions safely, forward-only migrations.
- **Earlier upgrade notes** — what changed in older releases, when you skip several versions.

## Suggest a guide

Missing a guide you need — a deployment target, an integration, a migration? Open a guide-request issue at `https://github.com/sovrium/sovrium/issues` and we will prioritize it.
