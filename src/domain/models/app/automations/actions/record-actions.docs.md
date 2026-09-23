# Record Actions

> Reading and writing table records from a workflow — single-row CRUD, filtered reads, and the batch operators.

`read` fetches one row by primary key and takes an `id`. `list`, `update`, `delete` and `upsert` select rows with a condition-group `filter`. Creates and updates carry a `data` map. The batch operators iterate an `items` array.

| Operator      | Props                                                       | Does                                                 |
| ------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| `create`      | `table`, `data`                                             | Inserts one record                                   |
| `read`        | `table`, `id`                                               | Reads one record by primary key                      |
| `list`        | `table`, `filter?`, `fields?`, `sort?`, `limit?`, `offset?` | Reads a filtered, ordered, paged set                 |
| `update`      | `table`, `data`, `filter`                                   | Updates the records matching the filter              |
| `delete`      | `table`, `filter`                                           | Soft-deletes the records matching the filter         |
| `upsert`      | `table`, `data`, `filter`                                   | Updates if a match exists, otherwise creates         |
| `batchCreate` | `table`, `items`, `continueOnItemError?`                    | Inserts many records from an array                   |
| `batchUpdate` | `table`, `items`, `continueOnItemError?`                    | Updates many records from an array                   |
| `batchUpsert` | `table`, `items`, `matchField`, `continueOnItemError?`      | Upserts many records, matched on a field             |
| `batchDelete` | `table`, `filter`, `limit?`                                 | Deletes the records matching the filter, up to a cap |

<!-- sovrium:options RecordActionSchema -->

`batchUpsert` requires **`matchField`**: the field name used to decide, per item, between an update and an insert. A configuration without it is refused at validation rather than guessing at a key.

`continueOnItemError` defaults to `false` on all three item-wise batch operators, so a batch stops at the first failing item. Set it to `true` to process the remainder and collect the failures instead.

```yaml
- name: logActivity
  type: record
  operator: create
  props:
    table: activity_log
    data:
      action: 'order.created'
      order_id: '{{trigger.data.id}}'
      occurred_at: '{{now}}'
```

```yaml
- name: importRows
  type: record
  operator: batchCreate
  props:
    table: contacts
    items: '{{parseLeads.result}}'
    continueOnItemError: true
```

## Reading a set with `list`

`read` answers "give me this row". `list` answers "give me these rows, in this order": it owns the `filter`, and with it `sort`, `limit`, `offset` and `fields`. Both emit the same output shape, so a template reads the same whichever produced it.

```yaml
- name: pendingOrders
  type: record
  operator: list
  props:
    table: orders
    filter:
      logic: and
      conditions:
        - { field: status, operator: equals, value: pending }
    sort:
      - { field: priority, direction: desc }
      - { field: created_at }
    fields: [reference, total, status]
    limit: 50
    offset: 0
```

`sort` is a list of ordering keys applied left to right — the second breaks ties in the first — and each `direction` defaults to ascending. Ordering and paging happen in the database rather than by fetching the table and trimming it afterwards. A `sort` field naming no column is refused: at startup when written literally, at run time when it arrives from a template.

An implicit ascending `id` is appended as the **final** ordering key whenever paging applies, including alongside a `sort` you wrote yourself. Rows that tie on your keys have no defined order between them, and untied rows are repeated or skipped across a page boundary just as readily as with no sort at all. The query that runs therefore carries one ordering key more than the configuration names.

### `fields` is a payload trim, not a permission boundary

It chooses which columns are carried into the step payload, and each returned record still carries `id`, `created_at` and `updated_at`.

An automation run has **no user role**, so field-level read permissions never apply to it: whatever an automation may read the table for, it may read every column of. Do not reach for `fields` as a way to keep a column away from a workflow.

### `limit` means two different things

On `list` it is a page size: it truncates, quietly and by design. On `batchDelete` it is a safety threshold: exceeding it fails the run and deletes nothing. Both accept 1 to 10000, and only one of them stops at the number.

## Writes go through the ordinary rules

A record action passes the same access control and the same validation as the records API, and `delete` is soft by default — it sets the deletion timestamp and leaves the row recoverable. An automation is a caller like any other; it is not a back door into the table.
