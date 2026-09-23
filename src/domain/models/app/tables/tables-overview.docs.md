# Tables Overview

> Configure data tables — structure, table-level properties, and the base field properties every field type shares.

Tables define your data models. Each table is a distinct entity (users, products, orders) whose `fields` declare the columns that records can store. Tables are the foundation of a Sovrium app: pages render their records, forms write to them, automations react to their changes, and the REST and MCP APIs expose them.

A table has at minimum an `id`, a `name`, and a `fields` array. Everything else — primary keys, indexes, constraints, views, permissions, webhooks, and AI exposure — is optional and layered on top.

```yaml
tables:
  - id: 1
    name: Contacts
    fields:
      - { id: 1, name: email, type: email, required: true, unique: true }
      - { id: 2, name: full_name, type: single-line-text, required: true }
      - { id: 3, name: created_at, type: created-at, indexed: true }
```

## Table Properties

Each entry in the `tables` array accepts the following properties.

<!-- sovrium:options TableSchema depth=1 -->

`id` is auto-generated from the table's position in the array when omitted, and `fields` requires at least one entry. Everything else may be left out.

The top-level `unique` array is sugar rather than a distinct mechanism: a single-field entry folds into that field's own `unique`, and a multi-field entry becomes a unique index. Single-column foreign keys are likewise not declared here — they are created for you from every `relationship` field. `foreignKeys` exists only for a reference spanning several columns at once.

## Soft delete is the default

Deleting a record sets `deleted_at` and `deleted_by` and leaves the row recoverable. Irreversible erasure is a separate operation on the records API — `?permanent=true`, admin-only on every table, or `?purge=true`, which also removes the record's attached files. **Records: Soft Delete and Restore** has both.

**`allowForceDelete` is accepted and not read.** It validates, and nothing in the engine consults it: there is no per-table force-delete endpoint, so setting it neither grants nor withholds anything. Whether a hard delete is possible on a table is decided entirely by the caller's role on `?permanent=true`, which this flag does not affect in either direction. Do not reach for it to protect a ledger, and do not reach for it to open one up.

`allowDestructive` is the equivalent opt-in one layer down, for the schema rather than the row: without it, a migration that would drop a column still present in the database stops with an error instead of deleting the data that column held.

## Base Field Properties

Every field extends a common base, whatever its type.

<!-- sovrium:options BaseFieldSchema -->

`default` is deliberately absent from that list. It is type-specific rather than shared: most value-carrying fields (text, numeric, selection, date, colour) expose a `default` whose value type matches the field, while system fields, relational fields and computed fields do not. Each field-type article states whether its types accept one.

A field that declares both `required` and `default` may still be omitted by a write — the column supplies the value.

## A richer table

```yaml
tables:
  - id: 2
    name: Products
    fields:
      - { id: 1, name: sku, type: single-line-text, required: true, unique: true }
      - { id: 2, name: title, type: single-line-text, required: true, indexed: true }
      - { id: 3, name: description, type: long-text }
      - { id: 4, name: price, type: currency, required: true, currency: USD }
      - { id: 5, name: in_stock, type: checkbox, default: true }
    primaryKey: { type: auto-increment, field: id }
    indexes:
      - { name: idx_products_sku, fields: [sku], unique: true }
    permissions:
      read: all
      create: [admin, editor]
      update: [admin, editor]
      delete: [admin]
```
