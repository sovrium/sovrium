# Inventory workspace

A self-hosted database workspace for products, stock, and orders — an Airtable
alternative you own. Six linked tables behind spreadsheet-style grids.

## Structure

```
app.yaml                          entry point — scalars inline, everything else $ref'd
config/
  auth.yaml                       email + password; first user becomes admin
  theme.yaml                      extends the Sovrium design system
  tables/
    suppliers.yaml                vendors + the AI-derived columns
    warehouses.yaml               storage locations
    products.yaml                 the flagship catalog table
    stock_movements.yaml          append-only stock ledger
    orders.yaml                   customer orders
    order_lines.yaml              one row per product on an order
  pages/
    _nav.yaml                     the table tabs, $ref'd into every page
    sign-in.yaml                  /sign-in
    products.yaml                 /          the main grid + expand-record panel
    orders.yaml                   /orders    orders + order lines
    stock.yaml                    /stock     movements + warehouses
    suppliers.yaml                /suppliers
    assistant.yaml                /assistant AI chat over every table
  agents/
    catalog-assistant.yaml        reads and edits records with the member role
  automations/
    flag-low-stock.yaml           emails purchasing when stock hits zero
public/                           static files served at the root
```

Conventions: one file per collection entity, one file per singleton, scalars
inline in `app.yaml`.

## Running it

```bash
sovrium validate app.yaml     # check the config
sovrium start app.yaml        # boot on http://localhost:3000
```

Zero config required: SQLite and local file storage by default. Set
`DATABASE_URL` for Postgres. See `.env.example`.

## The data model

```
suppliers ──< products >── stock_movements >── warehouses
                  │                                 │
                  └──< order_lines >── orders ───────┘
```

`products.movement_count` counts its `stock_movements`, `products.units_moved`
rolls up their quantity, and `products.stock_value` multiplies price by stock —
all computed in the database, so they cannot drift from the source rows.

## Editing it

- **Add a field** — add an entry to the table's `fields:` list with a unique
  `id`, then add a matching column to that table's grid page.
- **Add a table** — new file under `config/tables/`, `$ref` it from `app.yaml`,
  add a page and a tab in `config/pages/_nav.yaml`.

Run `sovrium validate app.yaml` after every change.

## Rules the validator enforces

- **Field names are snake_case and cannot be SQL keywords.** `order` is
  rejected, which is why the join field here is `sales_order`.
- **A rollup aggregates stored numeric columns only** — integer, decimal,
  currency, percentage, duration. `SUM` over a `formula` column is rejected, so
  `orders` rolls up `quantity` rather than `line_total`.
- **`computeOn` is required** on `ai-categorize`, `ai-extract`, `ai-tag`, and
  `ai-translate` (optional on `ai-generate`, `ai-sentiment`, `ai-summary`).

## Things to know

Verified live on this config. These are platform behaviours, not config mistakes
— do not "fix" them by rewriting this config.

- **The expand-record drawer renders exactly the fields you list in
  `recordFields`.** It does not derive them from the table, so omitting the list
  opens an empty panel with a save button. Its labels are the raw field names —
  `RecordDrawerField` has `name`, `type` and `renderAs`, but no `label`.
- **An `array` field read back on SQLite returns the JSON string** (`'["a"]'`)
  rather than an array. `multi-select` is unaffected.
- **A `formula` over money must DECLARE its currency** — see `stock_value`,
  which carries `currency: EUR` beside its `format: currency`. Nothing is
  inherited from the fields the expression multiplies: a formula may touch
  several fields or none, so any inheritance rule would have to guess. Omit the
  code and the amount renders in the USD default.

Everything this file previously listed here — grouped grids refusing to edit,
`status` colours going unpainted, `currency` ignoring its code, `showRowNumbers`
and `duration.displayFormat` doing nothing, delete silently failing on a table
with a rollup, batch create rejecting multi-select, a `formula` having no
`currency` property to declare — is fixed. If you are reading this in a fork
whose engine predates that, those notes are in the git history.
