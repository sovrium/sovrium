---
name: sovrium-data-model
description: Use when designing, reviewing or changing the tables of a Sovrium app — adding a table or field, choosing a field type, linking tables with relationship, lookup, rollup or count fields, setting table, field or row-level permissions and roles, planning a rename, a type change or a column drop, or writing seed data. Triggers include "model this data", "add a table", "which field type", "one-to-many", "who can see this", "rename a field", "migration", "sovrium seed", and a spreadsheet or Airtable base to bring into Sovrium.
license: BSL-1.1
metadata:
  author: sovrium
  version: '1.0.0'
---

# Sovrium data model

A bare agent models a Sovrium app like a spreadsheet: one wide table, comma-separated lists in a text cell, a copy of the customer's email on every order, a select that should have been a table, and permissions added last as an afterthought. Then it renames a field by deleting and recreating it, and the column's data goes with it. In Sovrium the table list is also the API, the permission boundary and the migration plan, so these mistakes ship to users.

Run the core loop from `sovrium-app` underneath this skill: edit → `sovrium validate` → `sovrium start --watch` → browser → API.

## Ask first

Before writing a table, get one-sentence answers to these. If the person cannot answer one, propose a default and say so.

```
- [ ] The things the app tracks (nouns), each in one sentence
- [ ] How they relate, each as a sentence: "a company has many contacts; a contact works at one company"
- [ ] Who creates, edits and reads each thing (the roles, named by job, not by person)
- [ ] SQLite (default, no DATABASE_URL) or PostgreSQL (DATABASE_URL set)
- [ ] When a person asks to be forgotten: erasure (hard delete) or keep an anonymised row
- [ ] Rough volume per table in a year: tens, thousands, millions
```

## Checklist

**Tables**

- [ ] One table per real-world thing. Two look-alike tables ("Leads", "Customers") become one table with a `status` field and two views.
- [ ] A `single-select` that starts growing attributes (a colour, an owner, a price per option) becomes its own table, linked.
- [ ] No per-period tables (`orders_2025`, `orders_2026`): one table with a date field and a filtered view.
- [ ] No god table: when half the fields are empty for half the rows, it is two things.

**Relations**

- [ ] Every relation chosen on purpose: many-to-one (the default), one-to-many, many-to-many or one-to-one. Write the example sentence next to it.
- [ ] The link lives on the "many" side for many-to-one: an order points at its customer.
- [ ] `displayField` set to the field people recognise the related record by.
- [ ] `onDelete` decided: what happens to the orders when the customer is deleted.

**Derive, don't store**

- [ ] A number of related records is a `count` field; a value from the related record is a `lookup`; an aggregate over related records is a `rollup`. Never a copied value that can drift.
- [ ] One hop at a time: derive from a direct relation; if you need two hops, derive on the middle table first and read that.
- [ ] Computed values that depend only on the same row are `formula` fields.

**Normalisation smells, in plain words**

- [ ] Numbered fields (`phone_1`, `phone_2`, `phone_3`) → a related table.
- [ ] The same details typed on several rows (the customer's address on every order) → a related table plus a lookup.
- [ ] A parent's attribute copied onto every child → a lookup.
- [ ] A comma-separated list in a text cell → `multi-select` for a fixed vocabulary, a relationship for real things.
- [ ] A "custom fields" table of name/value rows → real fields; the config is cheap to change.

**Fields**

- [ ] Every field has an explicit `id`, unique in its table, never reused, never renumbered.
- [ ] A new field takes the next unused `id` in its table. An omitted `id` is not "no id": it is assigned by position, so inserting a field above it re-points the data behind every later field.
- [ ] `name` is the column and API key: lowercase letters, digits and underscores, starting with a letter, 63 characters at most. `label` is what people read.
- [ ] One naming convention across the app: singular snake_case field names (`due_date`, `customer`), table names naming the collection.
- [ ] The field people recognise a record by is short, unique where it can be (`unique: true`), and meaningful — not an internal code.
- [ ] Field type picked for the behaviour you need, not the look: see the choice table below and `references/field-types.generated.md`.

**Permissions**

- [ ] Roles named after job functions (`sales`, `support`), declared under `auth.roles`; built-ins are `admin`, `member`, `viewer`.
- [ ] Least privilege: each table's `permissions` names who may `read`, `create`, `update`, `delete`. Declaring one operation denies the others to non-admins; declaring none leaves the table open to every non-viewer role.
- [ ] Separation of duties where it matters: the role that creates an invoice is not the only role that approves it.
- [ ] Field permissions only narrow what the table allows; never use them to widen.
- [ ] Row scoping (`rowLevelPermissions`) declared once, server-side — not re-implemented as page filters.
- [ ] A private record answers 404 to everyone else. That is correct; test it.

**Change over time**

- [ ] Rename = keep the `id`, change the `name`. The data stays; API clients using the old name break, so tell them.
- [ ] Type change or split = expand → migrate → contract: add the new field, copy the data, move readers, then remove the old field in a later change.
- [ ] Never retype a populated field in place without `sovrium migrate --dry-run` first.
- [ ] A column drop needs `allowDestructive: true` on the table and the owner's explicit yes.

**Seed data**

- [ ] Reference data (statuses, categories) and samples kept apart.
- [ ] 5–15 realistic sample rows per table, linked to each other, with dates relative to today.
- [ ] Re-runnable: `sovrium seed` defaults to `if-empty`; use `upsert` with `mergeOn` for reference data.

## Field type choice

| You need                                        | Choose                                                 | Not                                    |
| ----------------------------------------------- | ------------------------------------------------------ | -------------------------------------- |
| Free text a person types                        | `single-line-text`, `long-text`, `rich-text`           | `single-select` with an "Other" option |
| A small fixed vocabulary                        | `single-select`, `multi-select`, `status`              | a text field and a promise             |
| A vocabulary that grows attributes              | a table + `relationship`                               | a select with encoded names            |
| A value from a related record                   | `lookup`                                               | a copied text field                    |
| A total, min, max, average over related records | `rollup`                                               | a number updated by an automation      |
| How many related records                        | `count`                                                | a number field                         |
| A value computed from the same row              | `formula`                                              | an automation writing a field          |
| Money                                           | `currency`                                             | `decimal` plus a currency text field   |
| Who and when                                    | `created-by`, `created-at`, `updated-by`, `updated-at` | fields filled by hand                  |

The full list with every option, generated from the binary you run: `references/field-types.generated.md`, or `sovrium docs config tables[].fields[].type`.

## Output template

Produce these, in this order, before or with the config edit:

1. **Table list**: one line per table — what one row is, and roughly how many there will be.
2. **Field table** per table: `id | name | label | type | required | notes`.
3. **Relation diagram** in Mermaid:

   ```mermaid
   erDiagram
     COMPANY ||--o{ CONTACT : "employs"
     CONTACT ||--o{ DEAL : "owns"
     DEAL }o--o{ PRODUCT : "includes"
   ```

4. **Permissions table**: `table | read | create | update | delete | field and row rules`.
5. **The config edit**, then `sovrium validate`.
6. **Verification**: `sovrium start --watch`; `GET /api/tables/<table>/records` as an allowed role and as a denied one (expect `404` or an omitted field); one record page in the browser; a lower-privilege account sees what it should and nothing more.

## Anti-patterns

- Deleting a field and adding a new one to "rename" it (the data is dropped).
- Omitting field `id`s, then inserting a field in the middle.
- A text cell holding "Acme, Globex, Initech".
- A `settings` or `metadata` JSON field as a place to put structure.
- Storing a total and updating it from an automation instead of a `rollup`.
- Copying the customer's email onto every order.
- Tables per client, per year, or per region.
- Permissions checked in page filters instead of on the table.
- Turning on `allowDestructive` to make a validation error go away.
- Seed files with `test1`, `foo`, `lorem ipsum`.

## References

- [references/relations.md](references/relations.md) — read when linking tables: cardinality in sentences, which side holds the link, lookups, rollups, counts, delete behaviour.
- [references/permissions.md](references/permissions.md) — read when anyone other than an admin will use the app: roles, table, field and row rules, precedence, the 404 rule, how to test it.
- [references/migrations.md](references/migrations.md) — read before renaming, retyping, splitting or dropping anything that already holds data.
- [references/field-types.generated.md](references/field-types.generated.md) — read when choosing or configuring a field type; generated from the binary.
- [references/sources.md](references/sources.md) — where the practices in this skill come from.
