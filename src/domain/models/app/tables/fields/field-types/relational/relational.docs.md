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

A link is optional unless it says `required: true`. A relationship that sets no `required` may be left empty, exactly as one that says `required: false`. So two tables may link each other — a department naming its head, the head belonging to a department — and the app boots: the first record is written with its link empty, and an update closes the loop. A loop in which every link says `required: true` is refused when the config is decoded, since no record of any of its tables could be written first.

A relationship value is the related record's id as a string — `"1"`, or `["1", "2"]` for many-to-many — and either spelling is accepted on input and in filters. A webhook's `data.record` and `previousValues`, a realtime event's `record` and `oldRecord`, and the record an automation is triggered with read it the same way.

`displayField` names the field of the related table that stands for a linked record wherever one is shown, so a grid reads `Zoom` rather than the key `30`. The stored key never changes: filtering, sorting and editing keep using it. That label is a value of the related table, so a reader sees it only if they may read that field there; anyone else sees the key.

A link to many records — `one-to-many` or `many-to-many` — lists keys of another table, so it is a read of that table. To a reader the related table refuses, the field is left out of the record, its keys and its labels alike, on a single read and on a list, exactly as a count over the same link is; it is never answered as an empty list, which would say that nothing is linked. A field rule on the link holds as on any other field, and a count, rollup or lookup read through a link withheld from a reader is left out of the record with it. Within a table the reader may read, the list holds only the linked records she may read: those her row-level read rule lets her read, and never one in which she may read no field — on a table listed in `auth.scopeTables` whose fields her role cannot read, only the records a grant gives her. A many-to-one link keeps the key it stores.

A write may only link rows its writer may read. A link to a row the writer may not read — the related table refuses their role, or a row-level rule hides that row — is answered exactly as a link to a row that does not exist, and nothing is written. A many-to-many value naming any unreadable row is refused whole, and leaving the field out of an update keeps the links the writer cannot see.

An update's many-to-many value adds to the links a record has: sending `["2"]` to a record linked to `["1", "3"]` leaves three links. An empty list or `null` removes every link the writer may read, so dropping one link is two updates — clear the field, then send the links to keep.

A page can show a different field of the related table in one grid column with `columns[].displayField`; see the table component.

A table can link to itself many-to-many — people and their mentors among the people. A many-to-many link keeps its links in a table named from the two tables, source first (`people_people`), with one column per end named after its singular (`person_id`); when both ends share that name, as a table linked to itself does, the related end's column is `related_person_id`. Renaming the table carries the links with it. A link to itself runs one way: Katherine listing Ada among her mentors does not list Katherine among Ada's.

**Two links to the same table.** A table may declare two or more many-to-many fields that point at the same table: an article cites its sources and features some of them, or a person has mentors and mentees among the people. Each field keeps its own links. A link written through one never reads back through the other, on the record, through a lookup, a rollup or a count, or on the related table's own field. A field that is the only many-to-many from its table to the related one stores its links in the table named from the two tables (`articles_sources`). Once two or more fields point at the same table, each stores its links in a table named after the field too (`articles_sources_source`, `articles_sources_featured`). Renaming one of those fields under its id carries its links. A config is refused when one of those names is taken by a table, a view or another link table, or when two of them would read alike once PostgreSQL cuts names to 63 characters.

The related table's own many-to-many field back (`cited_in` on `sources`) shows the links of the field it is the reciprocal of: the one either side names with `reciprocalField`, or, when neither side names one, the only many-to-many in each direction between the two tables. The links of any other field are not mirrored onto it.

**Upgrading.** Adding a second many-to-many field to the same table keeps the links already stored under the first field, and the new field starts empty. Earlier versions stored the links of two such fields in one link table, with nothing recording which field wrote each link. On the first start of a database in that state, every stored link is kept under each of the fields that shared the table, and the fields stay separate from then on. The start prints a warning naming the link table, the fields and the number of links, so that someone reviews each field and removes the links that do not belong to it. No link is lost. The start does this even when the config has not changed.

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

A lookup is computed once and every reader reads the same value, so its `filters` may not compare to `$currentUser`: a config doing so is refused when it is read, naming the field, wherever the reference sits in an `and` or `or` group. To list a reader's own records, filter a view on `$currentUser` instead.

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

`filters` takes a single condition or an `and` / `or` group, nested as deep as needed, exactly as a view's filter does.

A rollup is computed once and every reader reads the same value, so its `filters` may not compare to `$currentUser`: a config doing so is refused when it is read, naming the field, wherever the reference sits in an `and` or `or` group. To aggregate a reader's own records, filter a view on `$currentUser` instead.

Like a lookup, a rollup is derived and read-only. Unlike a lookup it reads _many_ rows, so the aggregation is the whole of its meaning — and what an EMPTY set yields differs by aggregation:

| Aggregation                   | Over no related rows |
| ----------------------------- | -------------------- |
| `avg`, `min`, `max`           | null                 |
| `arrayUnique`                 | an empty array       |
| `sum`, `count`, anything else | `0`                  |

A surface that displays several rollups side by side should expect that difference rather than treating a blank cell as a zero.

A SUM, AVG, MIN or MAX rollup over a `currency` field is money in that field's currency: it takes the field's `currency`, `precision`, `symbolPosition`, `negativeFormat` and `thousandsSeparator`, so `format: currency` is enough, and so is nothing at all. Declare any of the five on the rollup to override that one setting (`precision: 0` keeps the source's currency). A COUNT, COUNTA, COUNTALL or ARRAYUNIQUE counts or lists records and is never shown as money.

`sum` and `avg` accept `integer`, `decimal`, `number`, `currency`, `percentage`, `duration`, `rating` and `progress` fields, and a `formula` whose `resultType` is a number. An `autonumber` is refused: adding up a sequence means nothing. A `min` or `max` rollup over a date reads as that day (`2026-10-05`) on both engines.

**A rollup or a count into a table its reader may not read, or over a related field that reader may not read, is left out**, exactly as a lookup is — on a single read, a list, the trash, an export (the column stays, its cells empty), a page, an AI client's tools, a live change and a read by an automation someone started by hand; a filter, a sort, a grouping or an aggregate on it evaluates it as empty. A formula built over such a field is left out with it. **Within a table its reader may read, a rollup or a count aggregates every related record, whatever the reader's row-level read rule.** It is a value the app publishes on purpose; an app that must not disclose how many hidden records are linked, or what they add up to, declares no rollup or count over that link. To show a public total drawn from a table its readers may not read — seats taken, orders received — store that total in a number field of the public table, and keep it current with an automation that recounts it whenever a related record is created, changed or deleted; the events template shows the pattern.

**Soft-deleted related rows do not contribute.** The aggregate skips any related record whose `deleted_at` is set, so trashing a child row lowers its parent's rollup immediately — and restoring it raises the rollup again.

**A rollup or a count reads through every kind of link**, on both database engines. Through a `one-to-many` link it aggregates the related records that point at this one. Through a `many-to-many` link it aggregates the linked records, whichever table wrote the link — with or without a `reciprocalField` on the other side — and counts each linked record once. Through a `many-to-one` or `one-to-one` link it aggregates the one linked record, or none: a `count` reads `1` or `0`, and a `sum` over no linked record reads `0`, as the table above says.

## Read state

`readState: true` on the link field of a child table — a message's `channel` — keeps, for each reader and each parent record, how far she has read its children.

```yaml
tables:
  - name: messages
    fields:
      - name: channel
        type: relationship
        relatedTable: channels
        readState: true
```

Each `channels` row then carries `unreadCount` for the reader who asked: the messages created after her last-read position that she may read, her own excepted. A row read without a reader carries no count. Name the count with `readState: { as: unreadMessages }`; a name is required when two relationships with `readState` point at the same table.

A message scroller showing a channel's messages marks the channel read as it draws them, and places a "New" marker above the first message she had not read. Any other surface marks it read with `POST /api/tables/channels/records/:id/read`, which answers `404` for a channel she may not read. Read positions are personal data: listed in her account export and deleted with her account.
