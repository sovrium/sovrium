# Fieldday Events

> A community's events: what is on with the seats left, registration with no account, a waitlist.

Built with [Sovrium](https://sovrium.com) — a configuration-as-code interpreter: one config
file in, a complete self-hosted web application out.

[![Deploy on Scalingo](https://cdn.scalingo.com/deploy/button.svg)](https://dashboard.scalingo.com/create/app?source=https://github.com/sovrium/events-template)

## Use this template

Click **Use this template** on GitHub to copy this app into your own repository (clean
history, yours to modify), or scaffold it locally:

```bash
curl -fsSL https://sovrium.com/install | sh
sovrium init my-events --template events
```

## What's inside

- **What's on** (`/`, public) — every open event, soonest first, as a card with its date,
  its hours, its place and how many seats are left, and one button. A full event says so,
  counts its waitlist and offers to join it instead.
- **Register** (`/register`, public) — the card's button opens the form with its event already
  chosen: a name, an email and one question. No account. The next page names the event, its
  date and its place, and the attendee gets a confirmation by email.
- **Join the waitlist** (`/waitlist/<event>`, public) — the same form for a full event; the
  registration is written as Waitlist.
- **Overview** (`/calendar`) — how many are registered, coming today and waiting, and which
  event is full; the month with every event on it; the seats taken per open event. **New
  event** opens a dialog; a new event starts as a draft, off the public page.
- **Registrations** — everyone grouped under the name of their event, newest first, with a
  filter bar. It is also the door: find a name and press **Check in**.
- **Analytics** — the public pages' views and one event per registration, counted on your own
  server with no cookie; an admin reads the registrations at
  `/api/analytics/events?event_type=track`.
- Optional: each event posted to your community's Discord channel as it opens. It uses the
  `discord` connection from the Sovrium library (`sovrium library add connection/discord`);
  set `DISCORD_BOT_TOKEN` and `DISCORD_CHANNEL_ID` to turn it on — without them the app runs
  exactly the same.
- Optional: the organizers' shared Google calendar filed every hour into a `calendar_events`
  table, so a planned date becomes an event without retyping it. It is the
  `google-calendar-events-to-table` recipe from the Sovrium library; set `GOOGLE_CLIENT_ID`
  and `GOOGLE_CLIENT_SECRET`, then connect the account from the admin's Connections page.

Sign-up is closed: an admin adds each organizer. Everything is declared in
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

Load the demo data first. It creates two accounts — the organizers of Fieldday, a software
community running workshops and meetups across France — seven events and their
registrations, dated relative to today:

```bash
SOVRIUM_SEED_PASSWORD=choose-a-password sovrium seed app.yaml
sovrium start app.yaml
```

1. Open `/`: four events, the Migration Workshop with 7 seats left, the Design Review Jam
   full with three people waiting.
2. Press **Register** on the workshop in a private window and register. The confirmation
   names the event.
3. Sign in as **elise.moreau@fieldday.example** (admin) or **nadia.ferhat@fieldday.example**
   (member), with the password you chose. The Overview counts one more registration.
4. Press **New event**, give it a name and a start, and create it: it lands on the calendar
   as a draft.
5. On **Registrations**, find Sven Halvorsen under Open Office Hours — today's event — and
   check him in.

Seats are advisory. Nothing refuses a registration once an event is full: the public page
stops offering Register and offers the waitlist instead, and an organizer moves someone off
the waitlist by changing their status to Confirmed. The seats taken and the waitlist are
numbers on the event, counted again by an automation after every change to a registration:
visitors read those numbers, never the registrations with their names and emails. Each
event's hours are words beside its date (`time_label`), because a relative date in the demo
data carries no time of day.

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
(source: [`templates/events`](https://github.com/sovrium/sovrium/tree/main/templates/events)).
Issues are welcome here; please send code contributions upstream to the monorepo so the
template stays in sync with the engine. The pinned engine release lives in
`.sovrium-version`.

License: [MIT](./LICENSE). The Sovrium engine itself is licensed separately
([BSL 1.1](https://github.com/sovrium/sovrium/blob/main/LICENSE.md)).
