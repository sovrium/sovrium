# Count & Autonumber Fields

> Two columns the engine fills in — a count of related records, and a sequence the database allocates.

Neither of these takes a value from a user. `count` is derived from a relationship; `autonumber` is allocated by the database on insert.

## `count`

Counts the records linked through a relationship field **in the same table** — a `rollup` narrowed to the one aggregation everybody wants.

<!-- sovrium:options CountFieldSchema -->

```yaml
- {
    id: 2,
    name: completed_task_count,
    type: count,
    relationshipField: tasks,
    filters: { field: status, operator: equals, value: completed },
  }
```

`relationshipField` must name an actual `relationship` field on the same table. That is checked when the configuration is decoded, so a typo or a reference to a field of another type stops the boot rather than counting nothing forever.

`filters` narrows what is counted, using the same condition grammar a view's filters use. Without it, every linked record counts — except a soft-deleted one, which never counts. Trashing a linked record lowers the count immediately, and restoring it raises the count again.

## `autonumber`

A database-assigned auto-incrementing integer — the field type behind invoice and order references. The column is a sequence, so the value is allocated by the database on insert and is never supplied by the client.

<!-- sovrium:options AutonumberFieldSchema -->

```yaml
- { id: 3, name: invoice_number, type: autonumber }
```

That produces `1`, `2`, `3`, and so on. `autonumber` takes no type-specific options at all: there is no prefix, no starting offset and no zero-padding. For a human-facing reference such as `INV-01000`, add a `formula` field that composes the number with the prefix and padding you want. That keeps presentation in one place and leaves the underlying sequence untouched, so the format can change without renumbering anything.

A sequence also does not promise to be gap-free. A transaction that allocates a number and then rolls back has still consumed it, which is correct — reusing it would let two records carry the same reference at different times.

## Both recompute rather than store

`count` recomputes when the links it counts change. `autonumber` is allocated once and then fixed. Neither is writable through the records API or a form: a write naming one is refused with `Cannot write to readonly field '<name>'` rather than accepted and discarded, and the refusal names every readonly column the request touched, not just the first.
