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

A relationship value is the related record's id as a string — `"1"`, or `["1", "2"]` for many-to-many — and either spelling is accepted on input and in filters. A webhook's `data.record` and `previousValues`, a realtime event's `record` and `oldRecord`, and the record an automation is triggered with read it the same way.

`displayField` names the field of the related table that stands for a linked record wherever one is shown, so a grid reads `Zoom` rather than the key `30`. The stored key never changes: filtering, sorting and editing keep using it. That label is a value of the related table, so a reader sees it only if they may read that field there; anyone else sees the key.

A write may only link rows its writer may read. A link to a row the writer may not read — the related table refuses their role, or a row-level rule hides that row — is answered exactly as a link to a row that does not exist, and nothing is written. A many-to-many value naming any unreadable row is refused whole, and leaving the field out of an update keeps the links the writer cannot see.

An update's many-to-many value adds to the links a record has: sending `["2"]` to a record linked to `["1", "3"]` leaves three links. An empty list or `null` removes every link the writer may read, so dropping one link is two updates — clear the field, then send the links to keep.

A page can show a different field of the related table in one grid column with `columns[].displayField`; see the table component.

A table can link to itself many-to-many — people and their mentors among the people. A many-to-many link keeps its links in a table named from the two tables, source first (`people_people`), with one column per end named after its singular (`person_id`); when both ends share that name, as a table linked to itself does, the related end's column is `related_person_id`. Renaming the table carries the links with it. A link to itself runs one way: Katherine listing Ada among her mentors does not list Katherine among Ada's.

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

Through a link to many records, a lookup reads the linked values as one text, sorted and joined by a comma and a space — `Alice, Bob, Charlie` — on both database engines.

A lookup is a read of the related record, so it answers to every rule a direct read of that record answers to: it shows a value only when the reader may read the related table, the linked record (the related table's row-level read rule) and the related field — and, when that field is a formula, every value the formula is built from, however many formulas deep. Otherwise its value is left out, exactly as the relationship's label is — a signed-out visitor reading a public table sees no lookup into a table only signed-in members may read, and a member sees no lookup into a table only admins may read. The relationship's key stays, since it is the record's own value, and every formula built on the lookup is left out with it. Through a link to many records, whether the link is this table's relationship or the related table's link back to this one, the records API narrows the lookup to the values of the linked records the reader may read, and leaves it out when none remains — a formula built on the lookup is left out whenever the lookup is narrowed; when a row-level read rule governs the related table, a page rendered on the server leaves such a lookup out whole. This holds on a single read, a list, the trash, an export, a page, an AI client's tools, a read by an automation someone started by hand and the record a write hands back to its writer, whichever fields are selected. A filter, a sort, a grouping or an aggregate on a lookup — the filter and sort of a list an automation someone started by hand runs included — evaluates a record whose linked record the reader may not read as if the lookup were empty; on a formula built on such a lookup, it evaluates every record as if the formula were empty. A lookup of another lookup answers to every record it reads through: it is left out when the row-level read rule of any of them hides it from the reader, and a filter, a sort, a grouping or an aggregate on it sees its value on the records whose every linked record she may read and evaluates the others as empty. When the lookup it copies reads through a link to many records, it carries that list as the reader's own read of the linked record narrows it — the values of the linked records she may read — and is left out when none remains; a page rendered on the server leaves it out whole. When the last of those links holds many records — a many-to-many link or a link back — the filter, sort, grouping or aggregate sees the list as narrowed for its reader: the values of the linked records she may read, never a hidden one. When an earlier link holds many records, or the copied field is a formula, it evaluates every record as empty for a reader a row-level read rule governs.

A linked record in the trash contributes nothing to a lookup, through a link to one record as through a link to many, just as it contributes nothing to a rollup. Trashing it empties or narrows the lookup for every reader. The record keeps the key it stores, and restoring the linked record puts the value back.

The relationship may point at the table it is declared on. An org chart whose `manager` links an employee to another employee reads the manager's name through a lookup like any other; a rollup or a count through such a relationship works the same way. Such a lookup may also read another lookup of the related record through that same relationship — an employee's skip-level manager, read as their manager's own `manager_name` — on both database engines.

Two tables cannot look each other up. When a project lists the titles of the notes that point at it and a note copies the title of its project, each value would be computed from the other, so the configuration is refused when it is read, with a message naming both fields and the link. A rollup or a count reads its related table the same way.

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

`sum` and `avg` accept `integer`, `decimal`, `number`, `currency`, `percentage`, `duration`, `rating` and `progress` fields, and a `formula` whose `resultType` is a number. An `autonumber` is refused: adding up a sequence means nothing. A `min` or `max` rollup over a date reads as that day (`2026-10-05`) on both engines.

**A rollup or a count into a table its reader may not read, or over a related field that reader may not read, is left out**, exactly as a lookup is — on a single read, a list, the trash, an export (the column stays, its cells empty), a page, an AI client's tools, a live change and a read by an automation someone started by hand; a filter, a sort, a grouping or an aggregate on it evaluates it as empty. A formula built over such a field is left out with it. **Within a table its reader may read, a rollup or a count aggregates every related record, whatever the reader's row-level read rule.** It is a value the app publishes on purpose; an app that must not disclose how many hidden records are linked, or what they add up to, declares no rollup or count over that link. To show a public total drawn from a table its readers may not read — seats taken, orders received — store that total in a number field of the public table, and keep it current with an automation that recounts it whenever a related record is created, changed or deleted; the events template shows the pattern.

**Soft-deleted related rows do not contribute.** The aggregate skips any related record whose `deleted_at` is set, so trashing a child row lowers its parent's rollup immediately — and restoring it raises the rollup again.
