# Kerlo Automations

> Automations that run in your own app, with every run kept.

Built with [Sovrium](https://sovrium.com) — a configuration-as-code interpreter: one config
file in, a complete self-hosted web application out.

[![Deploy on Scalingo](https://cdn.scalingo.com/deploy/button.svg)](https://dashboard.scalingo.com/create/app?source=https://github.com/sovrium/automation-recipes-template)

## Use this template

Click **Use this template** on GitHub to copy this app into your own repository (clean
history, yours to modify), or scaffold it locally:

```bash
curl -fsSL https://sovrium.com/install | sh
sovrium init my-automations --template automation-recipes
```

## What's inside

A small studio's lead intake, automated by four recipes that run inside the app:

1. **Webhook → record** (`capture-lead-from-webhook`) — a POST carrying the bearer token
   becomes a lead. Without the token it is refused and writes nothing.
2. **Record → email + log** (`log-new-lead`) — every new lead emails the team and adds a
   line to the activity log. The email is tried three times, with a growing wait, before the
   run fails.
3. **Cron → digest** (`daily-digest`) — weekday evenings at 18:00, Paris time, one email to
   the team.
4. **Failure → alert** (`alert-on-failure`) — a run that failed after its last retry is
   written to the activity log with its error. Sovrium itself emails the operators; this
   recipe does not send a second email.

The pages:

- **Recipes** (`/`, public) — the four recipes, each as its trigger, its steps and the lines
  of configuration that declare it, and a way to sign in.
- **Activity** — every run, newest first, with its recipe, its outcome and one line of why,
  and four figures above: runs in the log, succeeded, succeeded after a retry, failed after
  retries. `/activity?record=<id>` opens one run in a drawer with its attempts and its error.
- **Leads** — the leads the recipes wrote, newest first.

Sign-up is closed; an admin adds each account. Everything is declared in
[`app.yaml`](./app.yaml) and the [`config/`](./config) tree — no application code. Edit the
config, restart, done.

## Run locally

The lead webhook needs a token, and the app refuses to start without one, so the webhook
is never open by accident:

```bash
LEADS_WEBHOOK_TOKEN=choose-a-long-random-token sovrium start app.yaml
```

Everything else is zero-config: embedded SQLite, local file storage. See
[`.env.example`](./.env.example) for the optional variables (database, auth bootstrap,
email, demo data). Without `SMTP_HOST` the emails are logged instead of sent, and the runs
still succeed.

## What to try

Load the demo data first. It creates two demo accounts, eight leads and a week of runs,
dated relative to now:

```bash
SOVRIUM_SEED_PASSWORD=choose-a-password sovrium seed app.yaml
LEADS_WEBHOOK_TOKEN=choose-a-long-random-token sovrium start app.yaml
```

The week holds 17 runs: 15 succeeded, 1 succeeded after a retry (lead #7, Liam Carver) and 1
failed after 3 attempts (lead #6, Sofia Ricci: the mailbox rejected the sender).

1. Open `/` without signing in: the four recipes and their declarations.
2. Sign in as **maelle.kerlo@kerlo.example** (admin) with the password you chose; you land
   on **Activity**. Find the Retried and the Failed run, and open the failed one with
   `/activity?record=12`: 3 attempts, and the error word for word.
3. Post a lead to the webhook, first without the token (refused, 401), then with it:

   ```bash
   curl -X POST http://localhost:3000/api/automations/capture-lead-from-webhook/webhook \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer choose-a-long-random-token' \
     -d '{"name": "Inès Carvalho", "email": "ines.carvalho@porto-design.example", "company": "Porto Design"}'
   ```

   The lead appears on **Leads**, and the run at the top of **Activity**.

4. Sign in as **jules.morvan@kerlo.example** (member): he reads the runs and the leads, but
   only an admin deletes one. Both are demo accounts.

## Deploy

The **Deploy on Scalingo** button above provisions the app with a PostgreSQL addon
(Scalingo's filesystem is ephemeral — the database keeps your data across deploys; file
uploads are stored in Postgres too). Secrets are generated automatically; you only fill in
`BASE_URL`. Any other host works the same way: run the `sovrium` binary with this config
(see the [deployment guides](https://sovrium.com/en/docs/installation)).

## About this repository

This repository is **auto-published from the
[Sovrium monorepo](https://github.com/sovrium/sovrium)** on every release
(source: [`templates/automation-recipes`](https://github.com/sovrium/sovrium/tree/main/templates/automation-recipes)).
Issues are welcome here; please send code contributions upstream to the monorepo so the
template stays in sync with the engine. The pinned engine release lives in
`.sovrium-version`.

License: [MIT](./LICENSE). The Sovrium engine itself is licensed separately
([BSL 1.1](https://github.com/sovrium/sovrium/blob/main/LICENSE.md)).
