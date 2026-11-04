# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Sovrium configuration (app.yaml + config/), rendered by the Sovrium binary on shadcn/ui base-nova; there is no hand-written front-end.

## Users

A small team that pays for things and claims them back: everyone who files claims and sees only their own, and finance, who reads every claim, decides and repays.

## Product Purpose

A small team's expense claims: receipts, a decision in the app, and one transfer.

Halden Expenses — a small team's expense claims. Each person files what they paid with its
receipt and sees only their own claims, on the server; finance reviews with the receipt beside
the claim and decides in the app; approved claims wait on Reimburse until they are marked
repaid.

## Capabilities and Constraints

- **Tables** (2): expenses, bank_transactions (filled by the Qonto recipe)
- **Forms** (1): add-expense (opened from the Add expense button)
- **Pages** (5): my-expenses (`/`), review (admin), reimburse (admin), home (the sign-in
  landing), sign-in
- **Automations** (4): approve-expense, reject-with-reason (a saved reason marks a waiting
  claim Rejected), mark-reimbursed, and qonto-transactions-to-table — a
  library recipe (`library/recipe/`, with `library/connection/qonto.yaml`) that pulls the
  business account's transactions each morning once the Qonto keys are set
- **Singletons**: auth, design
- **Seed data**: `seed/` — four sign-in accounts and seventeen claims with their receipts
  (`seed/assets/`), dated relative to the day you seed
- **Static assets**: `public/` (served at the site root)

Every page, table and automation of halden-expenses is declared in its configuration and run by the Sovrium binary; there is no application code to change.

## Brand Commitments

The product is named halden-expenses. Copy addresses the reader as "you".

## Evidence on Hand

Not recorded yet. Record real content, data and assets with their paths; do not invent customers, testimonials, figures or claims.
