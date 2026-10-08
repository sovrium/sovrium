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

A `read` or `list` step's output is `{ record, records }`: `records` is the list of rows and `record` the first of them. Each record is the one `GET /api/tables/<table>/records/<id>` answers the run's caller: its `id` and relationship values as strings, every field both at the top level (`{{<step>.record.title}}`) and under `fields`, its many-to-many links, the `_display` labels, `createdAt` and `updatedAt`. A field named `created_by` or `updated_by` reads as `createdBy` or `updatedBy`, as the records API answers it. A `user` field reads as the person, as it does in a record trigger: `{{<step>.record.owner.email}}` and `.name` resolve, while `{{<step>.record.owner}}` alone still renders as the account id. The whole output carries the person as `{ id, name, email }`, at the top level and under `fields`; a field the run's reader may not read is left out, account id included. A run nobody started reads as an admin does. An attachment's `url` or `signedUrl` is a full address on your `BASE_URL` when one is set, so an email or a webhook call can carry it as a link, and a path from the site root otherwise. To act only when rows were found, branch or filter on `{{<step>.records}}` with `isNotEmpty` (or `isEmpty` for the opposite), and hand the list to a `code` step as `inputData: { rows: '{{<step>.records}}' }`.

### Upgrading to 0.30

Before 0.30, a `read` or `list` step handed the run the stored row: numeric ids, snake_case timestamps, and no many-to-many links or `_display` labels. From 0.30 each record is the records API's answer, so a template reading one of those keys must be renamed:

| Before 0.30                                  | From 0.30                                            |
| -------------------------------------------- | ---------------------------------------------------- |
| `{{<step>.record.created_by}}`               | `{{<step>.record.createdBy}}`                        |
| `{{<step>.record.updated_by}}`               | `{{<step>.record.updatedBy}}`                        |
| `{{<step>.record.created_at}}`, `updated_at` | `{{<step>.record.createdAt}}`, `updatedAt`           |
| `{{<step>.record.deleted_at}}`               | not carried: a `read` or `list` returns live records |

Record ids and relationship values are strings (`"12"`, not `12`): compare them as strings in a condition or a `code` step. The same holds for every item of `{{<step>.records}}`.

A `create` step's output carries the new record's `id`, so a later step reads it as `{{<step>.result.id}}`. An `upsert` step's output is `{ operation, id }`: `created` or `updated`, and the id of the row it wrote, either way. An `update` step's output is `{ updated, ids }`, how many rows it changed and their ids, so a later step reads `{{steps.<step>.updated}}`; a filter that matches nothing gives `{ updated: 0, ids: [] }`. A record written by `create`, `update`, `upsert` or `delete` starts the record automations of its table, as a write through the records API does.

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

It chooses which fields are carried into the step payload, and each returned record still carries `id`, `createdAt` and `updatedAt`.

A run nobody started — a schedule (including "run now"), a webhook, a record event, a form submission, an `automation:call` — has **no user role** and writes as the system, so field-level read permissions never apply to it: whatever an automation may read the table for, it may read every column of. Do not reach for `fields` as a way to keep a column away from a workflow.

A run someone started by hand — a manual trigger, a table button, an MCP action template or automation tool — writes as that person. Before a `create`, `update`, `upsert`, `delete` or batch step touches anything, it is checked against the table's grants, row-level rules (an update also on the row as it would be written) and field write permissions for them; a record those rules exclude fails the step with `Resource not found`, nothing is written, and the run history records the failure. The rows it does write carry that person in their `created-by`, `updated-by` and `deleted-by` fields, whatever `runAs` says. It reads as that person too: a `read` of a record they may not read fails the step with `Resource not found`, a `list` holds only the records they may read, and a field they may not read is left out of the output, as is a lookup of a record they may not read. Clearing a many-to-many field unlinks only the links that person may read. A run that pauses on an approval resumes as the same person, whoever approves it, and, if that person has been banned or removed meanwhile, fails with `Resource not found` before any of its remaining steps runs — an email or an HTTP call after the approval included.

### `limit` means two different things

On `list` it is a page size: it truncates, quietly and by design. On `batchDelete` it is a safety threshold: exceeding it fails the run and deletes nothing. Both accept 1 to 10000, and only one of them stops at the number.

## Writes go through the ordinary rules

A record action passes the same access control and the same validation as the records API, and `delete` is soft by default — it sets the deletion timestamp and leaves the row recoverable. An automation is a caller like any other; it is not a back door into the table.
