# Field Notes — a blog

> A publication: essays with covers, moderated comments, an RSS feed, and a desk that
> schedules posts.

Built with [Sovrium](https://sovrium.com) — a configuration-as-code interpreter: one config
file in, a complete self-hosted web application out.

[![Deploy on Scalingo](https://cdn.scalingo.com/deploy/button.svg)](https://dashboard.scalingo.com/create/app?source=https://github.com/sovrium/blog-template)

## Use this template

Click **Use this template** on GitHub to copy this app into your own repository (clean
history, yours to modify), or scaffold it locally:

```bash
curl -fsSL https://sovrium.com/install | sh
sovrium init my-blog --template blog
```

## What's inside

Field Notes, a fictional publication a small studio owns. Readers get an index of essays
with their covers — the latest one large — one page per essay with its byline, its body and
the comments the editor approved, and an RSS feed at `/feed.xml`. A draft or a scheduled
post is never on the public pages: its address answers 404.

Behind `/admin` the editor has a desk: every post with its state, an edit page where giving
a draft a publish date schedules it, the comments waiting to be read, and an assistant that
proposes drafts — nothing it writes is saved before the editor approves it. Every hour, a
scheduled post whose date has come goes live on its own. A comment arrives Held and appears
under its essay once the editor sets it to Approved. Nobody can open an account; the editor
comes from `AUTH_ADMIN_EMAIL` and `AUTH_ADMIN_PASSWORD`.

When a comment arrives, a language model sorts it — a question, a correction, praise or
spam — and the desk shows that beside it; it labels only, the editor still decides. The
model is the one `AI_PROVIDER` names (a local Ollama by default): with no provider set the
comment keeps no label, and the run says why on the admin console's Runs page.

Under the essays, readers can subscribe to the newsletter; the addresses stay in your own
`subscribers` table. Optional: each address is also sent to Brevo as a contact, for the
sending. It is the `form-to-brevo` recipe from the Sovrium library (`sovrium library add
recipe/form-to-brevo`); set `BREVO_API_KEY` to turn it on — without it the app runs exactly
the same.

Everything is declared in [`app.yaml`](./app.yaml) and the [`config/`](./config) tree — no
application code. Rename the publication in `config/pages/`, replace the essays in `seed/`.

## Run locally

```bash
sovrium seed app.yaml        # needs SOVRIUM_SEED_PASSWORD, see .env.example
sovrium start app.yaml --watch
```

Zero-config: embedded SQLite, local file storage. The covers and portraits live in a
public `images` bucket, so readers' browsers load them with no session. The assistant needs
an AI provider (see [`.env.example`](./.env.example)) — without one the rest of the site
works and the assistant stays silent.

A draft or a scheduled post stays private: the posts table answers readers, the feed and the
records API with Published posts only.

## Deploy

The **Deploy on Scalingo** button above provisions the app with a PostgreSQL addon
(Scalingo's filesystem is ephemeral — the database keeps your data across deploys; file
uploads are stored in Postgres too). Secrets are generated automatically; you only fill in
`BASE_URL`. Any other host works the same way: run the `sovrium` binary with this config
(see the [deployment guides](https://sovrium.com/en/docs/installation)).

> **The demo accounts are for trying the app, not for running it.** The seed gives every
> account it creates, the admin included, the one password in `SOVRIUM_SEED_PASSWORD`, and
> their addresses are published in this README. Before anyone else can reach the app, choose
> a long password or skip the seed, and change or delete the demo admin. Sign-up is already
> closed (`allowSignUp: false`), so nobody can add an account of their own.

## About this repository

This repository is **auto-published from the
[Sovrium monorepo](https://github.com/sovrium/sovrium)** on every release
(source: [`templates/blog`](https://github.com/sovrium/sovrium/tree/main/templates/blog)).
Issues are welcome here; please send code contributions upstream to the monorepo so the
template stays in sync with the engine. The pinned engine release lives in
`.sovrium-version`.

License: [MIT](./LICENSE). The Sovrium engine itself is licensed separately
([BSL 1.1](https://github.com/sovrium/sovrium/blob/main/LICENSE.md)).
