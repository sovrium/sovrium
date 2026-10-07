# Halden Expenses

> A small team's expense claims: receipts, a decision in the app, and one transfer.

Built with [Sovrium](https://sovrium.com) — a configuration-as-code interpreter: one config
file in, a complete self-hosted web application out.

[![Deploy on Scalingo](https://cdn.scalingo.com/deploy/button.svg)](https://dashboard.scalingo.com/create/app?source=https://github.com/sovrium/expenses-template)

## Use this template

Click **Use this template** on GitHub to copy this app into your own repository (clean
history, yours to modify), or scaffold it locally:

```bash
curl -fsSL https://sovrium.com/install | sh
sovrium init my-expenses --template expenses
```

## What's inside

- **My expenses** (`/`) — your own claims and nobody else's: what waits on a decision, what
  is approved and on its way, what was repaid and what was rejected, with the reason. The
  table's row-level rule scopes every read to its owner on the server, for every page and
  every API call. **Add expense** takes the receipt, a description and the amount; it never
  asks who you are, because the server stamps whoever is signed in.
- **Review** (finance) — what waits on finance first, spend by category (rejected claims
  left out) and by month, then every claim with the person who filed it, its receipt, and
  Approve and Reject on each waiting row. Opening a claim shows the receipt beside the
  amount. A claim filed in the app also starts an approval run that only an admin can
  resolve — listed below the queue, where approving it resumes the run and marks the claim
  Approved.
- **Reimburse** (finance) — the approved claims, oldest first. Mark each one repaid once the
  money has gone out; the day is written on the claim.

Sign-up is closed: an admin adds each account. Everything is declared in
[`app.yaml`](./app.yaml) and the [`config/`](./config) tree — no application code. Edit the
config, restart, done.

Optional: the business account's settled transactions, pulled from Qonto every morning into
a `bank_transactions` table only admins read, so finance can match a repayment to the
payment that settled it. It is the `qonto-transactions-to-table` recipe from the Sovrium
library (`sovrium library add recipe/qonto-transactions-to-table`); set `QONTO_LOGIN` and
`QONTO_SECRET_KEY`, and replace `your-bank-account-id` in
`library/recipe/qonto-transactions-to-table.yaml`. Without them the app runs the same.

## Run locally

```bash
sovrium start app.yaml
```

Zero-config: embedded SQLite, local file storage, no env vars required to boot. See
[`.env.example`](./.env.example) for the optional variables (database, auth bootstrap,
email, demo data).

## What to try

Load the demo data first. It creates four accounts — the people of Halden, a small studio —
and seventeen claims filed between July and September, each with a sample receipt, dated
relative to today:

```bash
SOVRIUM_SEED_PASSWORD=choose-a-password sovrium seed app.yaml
sovrium start app.yaml
```

Sign in as **camille.roux@halden.example** (admin, runs finance) or
**lea.morel@halden.example** (member), with the password you chose. Then:

1. As Camille, land on **Review**: five claims wait on you, and the spend chart leaves the
   two rejected claims out.
2. As Léa, land on **My expenses**: seven claims, hers only. Click **Add expense** and file
   one with a photo of a receipt.
3. As Camille, open **Review**: Léa's new claim waits in the approval runs below the queue.
   Approve it, and it turns Approved on Léa's page. Only finance can resolve it: Léa, who
   filed it, cannot.
4. Open the Lyon dinner on Review to see the receipt beside the amount, then approve or
   reject it — a rejection takes a reason, which Léa reads on her claim.
5. On **Reimburse**, mark the approved claims repaid once the transfer has gone out.

"Spent this quarter" and "Repaid this quarter" add up every claim that was not rejected, and
every repaid one: on the demo data, which is all this quarter, that is the quarter.

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
(source: [`templates/expenses`](https://github.com/sovrium/sovrium/tree/main/templates/expenses)).
Issues are welcome here; please send code contributions upstream to the monorepo so the
template stays in sync with the engine. The pinned engine release lives in
`.sovrium-version`.

License: [MIT](./LICENSE). The Sovrium engine itself is licensed separately
([BSL 1.1](https://github.com/sovrium/sovrium/blob/main/LICENSE.md)).
