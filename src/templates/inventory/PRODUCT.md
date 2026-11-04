# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Sovrium configuration (app.yaml + config/), rendered by the Sovrium binary on shadcn/ui base-nova; there is no hand-written front-end.

## Users

A small distributor that keeps stock in its own warehouses: the operators who receive, pick, move and count, and the stock manager who also deletes records.

## Product Purpose

A stock workspace for a small distributor: products, stock per warehouse, orders, suppliers.

Brunel Stock — the stock workspace of a small distributor. Products is the home page: the
catalogue grouped by category with its stock on hand and value at cost, and a Reorder list
tab; a product opens in a drawer with every movement that made its stock. Stock is the signed
ledger per warehouse, Orders the customer orders by status, Suppliers the lead times, and the
Assistant answers from all of it.

## Capabilities and Constraints

- **Tables** (6): suppliers, warehouses, products, stock_movements, orders, purchase_orders
- **Pages** (6): products (`/`), stock, orders, suppliers, assistant, sign-in
- **Automations** (2): low-stock-digest (weekday 07:30 email to purchasing, counted, sorted
  and trimmed with `data` steps), and record-to-google-doc — a library recipe
  (`library/recipe/`, with its `library/connection/google.yaml`) writing each new order's
  confirmation in Google Docs once the Google keys are set
- **AI agents** (1): catalog-assistant — reads the tables and drafts purchase orders, with
  the member role
- **Singletons**: auth, design
- **Seed data**: `seed/` — two sign-in accounts, eleven products, three warehouses, five
  suppliers, the stock ledger, eight orders and three purchase orders, dated relative to
  the day you seed
- **Static assets**: `public/` (served at the site root)

Every page, table and automation of brunel-stock is declared in its configuration and run by the Sovrium binary; there is no application code to change.

## Brand Commitments

The product is named brunel-stock. Copy addresses the reader as "you".

## Evidence on Hand

Not recorded yet. Record real content, data and assets with their paths; do not invent customers, testimonials, figures or claims.
