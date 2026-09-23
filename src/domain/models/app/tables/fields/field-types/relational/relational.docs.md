# Relational Fields

> The three relational field types — relationship, lookup and rollup — that link tables and derive data without duplicating it.

Three field types connect tables and derive data from those connections. They form a chain: a `relationship` defines the link, then `lookup` and `rollup` read or aggregate through it.

| Type           | Purpose                                                               |
| -------------- | --------------------------------------------------------------------- |
| `relationship` | Creates a foreign-key link to another table. Foundation for the rest. |
| `lookup`       | Reads a single field value from a related record. Read-only.          |
| `rollup`       | Aggregates a field across many related records (sum, avg, …).         |

The `count` field — categorised as Advanced — also traverses a relationship.

## `relationship`

Creates a foreign-key link to another table. This is the field the other two read through, so it is declared first.

<!-- sovrium:options RelationshipFieldSchema -->

```yaml
- id: 1
  name: customer
  type: relationship
  relatedTable: customers
  relationType: many-to-one
```

`relatedTable` must name a table the config declares. A link to a table that does not exist is refused when the config is decoded, rather than at the first query that follows it.

## `lookup`

Reads one field from the record on the other end of a relationship. It is **read-only by construction**: the value lives in the related table, and writing it here would give one fact two homes that could disagree.

<!-- sovrium:options LookupFieldSchema -->

```yaml
- id: 2
  name: customer_city
  type: lookup
  relationshipField: customer
  relatedField: city
```

A lookup does not copy the value. It resolves at read time, so a change in the related record is visible immediately and no backfill is ever needed.

## `rollup`

Aggregates one field across every related record — the sum of a line-item total, the latest date, the count of open items.

<!-- sovrium:options RollupFieldSchema -->

```yaml
- id: 3
  name: order_total
  type: rollup
  relationshipField: line_items
  relatedField: amount
  aggregation: sum
```

Like a lookup, a rollup is derived and read-only. Unlike a lookup it reads _many_ rows, so the aggregation is the whole of its meaning — and what an EMPTY set yields differs by aggregation:

| Aggregation                   | Over no related rows |
| ----------------------------- | -------------------- |
| `avg`, `min`, `max`           | null                 |
| `arrayUnique`                 | an empty array       |
| `sum`, `count`, anything else | `0`                  |

A surface that displays several rollups side by side should expect that difference rather than treating a blank cell as a zero.

**Soft-deleted related rows do not contribute.** The aggregate skips any related record whose `deleted_at` is set, so trashing a child row lowers its parent's rollup immediately — and restoring it raises the rollup again.
