# Meridian People

> A small company's HR workspace: the team, who is away, and who decides.

Built with [Sovrium](https://sovrium.com) — a configuration-as-code interpreter: one config
file in, a complete self-hosted web application out.

[![Deploy on Scalingo](https://cdn.scalingo.com/deploy/button.svg)](https://dashboard.scalingo.com/create/app?source=https://github.com/sovrium/people-template)

## Use this template

Click **Use this template** on GitHub to copy this app into your own repository (clean
history, yours to modify), or scaffold it locally:

```bash
curl -fsSL https://sovrium.com/install | sh
sovrium init my-people --template people
```

## What's inside

- **Directory** (`/`) — everyone at the company by name, role and team. Opening a person
  shows who they report to, their time off this year and their requests. Their salary is
  sent to an admin only: for everyone else the server leaves the field out of every
  response, so it never reaches the browser.
- **Time off** — who is away this month, labelled by name: approved absences in green,
  requests waiting on a decision in amber, rejected ones not drawn. **Request time off**
  asks for the type and the dates only: the request is stamped with whoever is signed in.
- **Requests** (admins) — every request, the ones waiting on a decision first, with
  Approve and Reject on each row. A request filed in the app also starts an approval run
  that only an admin can resolve — listed below the grid, where approving it resumes the run
  and marks the request Approved.
- **HR overview** (admins) — headcount, the requests waiting on a decision, and headcount by
  team and approved days by type.

Sign-up is closed: an admin adds each account. Everything is declared in
[`app.yaml`](./app.yaml) and the [`config/`](./config) tree — no application code. Edit the
config, restart, done.

## Run locally

```bash
sovrium start app.yaml
```

Zero-config: embedded SQLite, local file storage, no env vars required to boot. See
[`.env.example`](./.env.example) for the optional variables (database, auth bootstrap,
email, demo data).

## What to try

Load the demo data first. It creates twelve accounts — the team of Meridian — each linked to
their row in the directory, and eleven time-off requests dated relative to today:

```bash
SOVRIUM_SEED_PASSWORD=choose-a-password sovrium seed app.yaml
sovrium start app.yaml
```

Sign in as **noor.haddad@meridian.example** (admin, runs HR) or
**tomas.ferreira@meridian.example** (member, a backend engineer), with the password you chose.
Then:

1. On **Time off**, see who is away this month and the four requests waiting on a decision.
2. As Tomás, click **Request time off** and ask for a few days: the form does not ask who
   you are.
3. As Noor, open **Requests**: Tomás's request waits in the approval runs below the grid.
   Approve it, and it turns Approved on the calendar.
4. Open Tomás in the **Directory** as Noor: his salary is there. Open the same card as Tomás:
   it is not, because the server never sent it.
5. As Tomás, try to open **Requests** or the **HR overview**: you are sent away.

## Deploy

The **Deploy on Scalingo** button above provisions the app with a PostgreSQL addon
(Scalingo's filesystem is ephemeral — the database keeps your data across deploys; file
uploads are stored in Postgres too). Secrets are generated automatically; you only fill in
`BASE_URL`. Any other host works the same way: run the `sovrium` binary with this config
(see the [deployment guides](https://sovrium.com/en/docs/installation)).

## About this repository

This repository is **auto-published from the
[Sovrium monorepo](https://github.com/sovrium/sovrium)** on every release
(source: [`templates/people`](https://github.com/sovrium/sovrium/tree/main/templates/people)).
Issues are welcome here; please send code contributions upstream to the monorepo so the
template stays in sync with the engine. The pinned engine release lives in
`.sovrium-version`.

License: [MIT](./LICENSE). The Sovrium engine itself is licensed separately
([BSL 1.1](https://github.com/sovrium/sovrium/blob/main/LICENSE.md)).
