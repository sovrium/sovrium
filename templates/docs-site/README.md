# Docs

> A documentation website from markdown files: a sidebar in sections, an outline, last-updated dates, an edit link and highlighted code.

Built with [Sovrium](https://sovrium.com) — a configuration-as-code interpreter: one config
file in, a complete self-hosted web application out.

[![Deploy on Scalingo](https://cdn.scalingo.com/deploy/button.svg)](https://dashboard.scalingo.com/create/app?source=https://github.com/sovrium/docs-site-template)

## Use this template

Click **Use this template** on GitHub to copy this app into your own repository (clean
history, yours to modify), or scaffold it locally:

```bash
curl -fsSL https://sovrium.com/install | sh
sovrium init my-docs --template docs-site
```

## What's inside

- **The landing page** (`/`) — what the site is in two sentences, the one command that
  starts it, and three ways into the documentation.
- **The documentation** (`/docs`) — opens on the introduction. Beside every page, the
  sections; above it, a search box; in it, the outline, the date it was last updated, a link
  to edit its source, and previous / next that follow the sidebar across sections. Notes,
  tips and warnings are set apart as callouts, and code is highlighted on the server.
- **A page that is not here** — an old address answers 404 with the way back.

Every page is a plain markdown file under [`content/docs/`](./content/docs), versioned with
the rest of the app. Everything else is declared in [`app.yaml`](./app.yaml) and the
[`config/`](./config) tree — no application code. Edit a file, restart, done.

## Run locally

```bash
sovrium start app.yaml
```

Zero-config: no database content, no sign-in, no env vars required to boot. See
[`.env.example`](./.env.example) for the optional variables.

## What to try

1. Open `/` and copy the command, or follow **Read the introduction**.
2. Open **Quick Start**: the outline beside it, the date it was last updated, **Edit this
   page**, and next — **Configuration**, in the Guides section.
3. Add a page: remove the `draft: true` line from `content/docs/guides/theming.md` and
   restart. It appears under Guides, after Deployment.
4. Open `/docs/configuration`, an old address: the page says so and links to where it moved.

To add a page, write a markdown file under `content/docs/` with a `title`, a `category`, an
`order` and an `updated` date in its frontmatter. Point "Edit this page" at your own
repository with `editUrl` in [`config/pages/docs.yaml`](./config/pages/docs.yaml).

## Deploy

The **Deploy on Scalingo** button above provisions the app with a PostgreSQL addon
(Scalingo's filesystem is ephemeral — the database keeps your data across deploys; file
uploads are stored in Postgres too). Secrets are generated automatically; you only fill in
`BASE_URL`. Any other host works the same way: run the `sovrium` binary with this config
(see the [deployment guides](https://sovrium.com/en/docs/installation)). A documentation
site can also ship as static files: `sovrium build app.yaml` writes every page to `./dist`.

## About this repository

This repository is **auto-published from the
[Sovrium monorepo](https://github.com/sovrium/sovrium)** on every release
(source: [`templates/docs-site`](https://github.com/sovrium/sovrium/tree/main/templates/docs-site)).
Issues are welcome here; please send code contributions upstream to the monorepo so the
template stays in sync with the engine. The pinned engine release lives in
`.sovrium-version`.

License: [MIT](./LICENSE). The Sovrium engine itself is licensed separately
([BSL 1.1](https://github.com/sovrium/sovrium/blob/main/LICENSE.md)).
