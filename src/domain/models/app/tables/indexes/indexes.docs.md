# Indexes & Constraints

> Primary keys, indexes including partial and unique ones, the top-level `unique` sugar, and CHECK constraints for rules a single field cannot state.

Beyond its fields, a table declares how its rows are identified, which lookups stay fast as it grows, and which rules the database itself enforces.

## Primary key

`primaryKey` controls how each row is uniquely identified. Left out, an auto-generated `id` column is the primary key.

<!-- sovrium:options PrimaryKeySchema -->

```yaml
primaryKey: { type: auto-increment, field: id }
```

```yaml
primaryKey: { type: composite, fields: [tenant_id, slug] }
```

`field` applies to `auto-increment` and `uuid`; `fields` to `composite`. Choosing `uuid` over `auto-increment` matters when ids travel outside the app: a sequential integer tells its reader how many records exist and what the neighbouring ones are called.

## Indexes

`indexes` is an array of index definitions. Index names are unique within the table and are checked at config time, along with the field names each index covers.

<!-- sovrium:options TableIndexSchema -->

```yaml
indexes:
  - { name: idx_users_email, fields: [email], unique: true }
  - { name: idx_orders_status, fields: [status] }
  - { name: idx_active_slug, fields: [slug], unique: true, where: 'deleted_at IS NULL' }
```

The order of `fields` is load-bearing: an index over several fields also speeds up a lookup on the first of them alone, but not on the second.

`where` makes the index **partial** — it covers only the rows satisfying the condition. Paired with `unique`, that is how a value is made unique among live rows while the soft-deleted ones keep their old values, which a plain unique index would refuse.

## The top-level `unique` array

`unique` is sugar for declaring uniqueness over one or more fields. A single-field entry folds into the equivalent of that field's own `unique: true`; a multi-field entry becomes a unique index.

```yaml
unique:
  - { fields: [slug] }
  - { fields: [tenant_id, slug] }
```

## CHECK constraints

A CHECK constraint carries a SQL boolean expression the database evaluates on every write. Constraint names are unique within the table.

<!-- sovrium:options CheckConstraintSchema -->

```yaml
constraints:
  - { name: chk_price_positive, check: 'price > 0' }
  - { name: chk_end_after_start, check: 'end_date > start_date' }
  - { name: chk_active_members_have_email, check: '(is_active = false) OR (email IS NOT NULL)' }
```

## Which of the two to reach for

`indexes` is for query performance and for uniqueness, over one field or several. `constraints` is for a conditional or cross-field rule that uniqueness cannot express — the expression relates two columns, or applies only when a third has a particular value. Both are checked against the table's real field names when the configuration is decoded.
