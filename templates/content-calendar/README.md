# Loomwork Content

> A content calendar: every piece on a month coloured by channel, a pipeline with the lead's approval, campaigns and a Monday digest.

Built with [Sovrium](https://sovrium.com) — a configuration-as-code interpreter: one config
file in, a complete self-hosted web application out.

[![Deploy on Scalingo](https://cdn.scalingo.com/deploy/button.svg)](https://dashboard.scalingo.com/create/app?source=https://github.com/sovrium/content-calendar-template)

## Use this template

Click **Use this template** on GitHub to copy this app into your own repository (clean
history, yours to modify), or scaffold it locally:

```bash
curl -fsSL https://sovrium.com/install | sh
sovrium init my-content-calendar --template content-calendar
```

## What's inside

- **Calendar** (`/`) — every dated piece on its day, marked by its channel: Website,
  LinkedIn and X, Email, Instagram, YouTube. A filter bar narrows the month to a channel or a
  campaign; a click opens the piece in a drawer with its owner, its campaign, its brief and
  its files. On a phone, the late piece is spelled out above the month.
- **Pipeline** — every piece from idea to scheduled, with its owner and its day; the late
  draft carries its flag and published pieces fold away. **Everyone** and **Mine** narrow
  the board. **New piece** opens a dialog; a new piece starts as an idea, owned by whoever
  added it.
- **Review** — moving a piece to Review asks the lead to approve it. The lead finds it under
  the board, approves it (the piece is then Scheduled) or sends it back to Draft.
- **All content** (`/content`) — the live campaigns on a strip against today, then every
  piece grouped under its campaign's name, with a count per campaign.
- **Monday digest** — every Monday at 09:00, one email with what goes out in the next seven
  days, day by day.

Sign-up is closed: an admin adds each teammate. Everything is declared in
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

Load the demo data first. It creates two accounts — the content team of Loomwork, a small
software company — four campaigns and fifteen pieces, dated relative to today:

```bash
SOVRIUM_SEED_PASSWORD=choose-a-password sovrium seed app.yaml
sovrium start app.yaml
```

1. Sign in as **nadia.brandt@loomwork.example** (member) with the password you chose. The
   Calendar shows the month, and the Instagram cut of the office hours is late.
2. Open **Install in four minutes** on the calendar: its brief, its owner Tomás Ruiz, its
   campaign, and its thumbnail.
3. On **Pipeline**, press **New piece**, give it a title and add it: it lands in Idea, yours.
4. Drag **How Cardinal Freight replaced six spreadsheets** to Review.
5. Sign in as **tomas.ruiz@loomwork.example** (admin). Under the board, approve it: it moves
   to Scheduled.
6. Open **All content** for the campaigns on their strip and every piece under its campaign.

Each piece's hour is a word beside its date (`time_label`), because a relative date in the
demo data carries no time of day. A member can still move a piece straight to Scheduled from
the board; the approval asks the lead, it does not lock the column.

## Deploy

The **Deploy on Scalingo** button above provisions the app with a PostgreSQL addon
(Scalingo's filesystem is ephemeral — the database keeps your data across deploys; file
uploads are stored in Postgres too). Secrets are generated automatically; you only fill in
`BASE_URL`. Any other host works the same way: run the `sovrium` binary with this config
(see the [deployment guides](https://sovrium.com/en/docs/installation)). Set
`SOVRIUM_DIGEST_TO` to the address the Monday digest goes to.

## About this repository

This repository is **auto-published from the
[Sovrium monorepo](https://github.com/sovrium/sovrium)** on every release
(source: [`templates/content-calendar`](https://github.com/sovrium/sovrium/tree/main/templates/content-calendar)).
Issues are welcome here; please send code contributions upstream to the monorepo so the
template stays in sync with the engine. The pinned engine release lives in
`.sovrium-version`.

License: [MIT](./LICENSE). The Sovrium engine itself is licensed separately
([BSL 1.1](https://github.com/sovrium/sovrium/blob/main/LICENSE.md)).
