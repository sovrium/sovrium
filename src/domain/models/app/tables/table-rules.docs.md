# Table Rules

> Business rules a record write must keep (locks, transitions and validations), refused with the author's own message, whoever writes.

A table's `rules` say what makes a write valid beyond what each field accepts on its own: an invoice keeps its number once it is validated, its status moves draft → validated → paid and never skips a step, and it cannot be validated without at least one line. Every rule of the table is judged on each write, and a write that breaks one is refused with `400` and the rule's message.

## Rules and permissions

The two answer different questions, and answer them differently.

- **Permissions** decide **who** may read or write a table, a field or a row. A caller they leave out is answered `404`, the answer a record that does not exist gets, so a refusal never tells her the record is there. See [Table Permissions](/en/docs/table-permissions).
- **Rules** decide **what** may be written, whoever writes it. A write that breaks one is answered `400` with the message you wrote, because the person writing can reach the record and needs to know why the change is refused.

Permissions are judged first. A caller who may not reach a record is answered `404` before any rule is read, so a rule's `400` never reveals a record she cannot see.

Rules are judged inside the write itself, on the record as it stands when the write lands. Of two changes sent to the same record at once, the second is judged on what the first left, so a lock, a transition or a validation holds however close together the writes arrive. Updates and deletes, one record or many, work this way, and so do upserts and restores: every upsert row is judged as what it becomes when the write lands (a row matching a record as that record's update, a row matching a record an earlier row of the same upsert created or changed on what that row left, and a row matching no record, even one whose record was deleted or renamed after it was sent, as the create of the record it adds), and restoring a record from the trash is judged as an update that changes no field. A lock that refuses deleting a record refuses bringing it back while it matches, and a validation judging updates keeps a record that breaks it in the trash. Deleting a record in the trash for good, or purging it, is judged as a delete of the record as it lies there, so a lock blocking `delete` keeps it in the trash while it matches. An update also checks that the record it writes is the one its rules were judged on: should another path change the record in between, the update is refused with `409` and nothing is written.

Rules bind every caller: a member, an admin, the top role, an automation (started by a record trigger, a schedule or by hand), the AI chat, the MCP tools and a hosted form's edit. The only way out of a rule is its `exemptRoles`, a list of roles the app declares. `sovrium seed` writes the rows it is given without judging them.

<!-- sovrium:options BusinessRuleSchema depth=1 -->

## Lock

A lock keeps fields from changing while the record, **as it is stored**, matches `when`.

```yaml
tables:
  - name: invoices
    fields:
      - { name: number, type: single-line-text }
      - { name: amount, type: decimal }
      - { name: status, type: single-select, options: [draft, validated, paid] }
    rules:
      - name: invoice-frozen-once-validated
        kind: lock
        when: { field: status, operator: in, value: [validated, paid] }
        fields: [number, amount]
        message: "The invoice number can't change after validation."
```

- A write that sends a locked field its current value passes, so a form posting every field still saves the free ones.
- `fields` names the locked fields. Left out, every field a caller can write is locked, less the ones `except` lists: the field that reopens the record, typically. The two cannot be combined.
- `blocks: [delete]` also refuses deleting a locked record, and restoring one from the trash. A lock never applies to a create.
- Without a `message`, the refusal reads « <Label> can no longer be changed. », naming the field by its label or, when it has none, by its column name made readable, so `expense_date` reads « Expense date ». A lock holding the whole record, with neither `fields` nor `except`, reads « This record can no longer be changed. »

<!-- sovrium:options LockRuleSchema -->

`when` takes the grammar of a row-level rule (a field, an operator and a literal value, or an `and` / `or` group) and may read a field of the record a many-to-one relationship points to, one relationship deep. The lines of an invoice can be frozen with their invoice:

```yaml
tables:
  - name: invoice_lines
    fields:
      - { name: label, type: single-line-text }
      - { name: invoice, type: relationship, relatedTable: invoices, relationType: many-to-one }
    rules:
      - name: lines-frozen-with-invoice
        kind: lock
        when: { field: invoice.status, operator: in, value: [validated, paid] }
        blocks: [update, delete]
        message: This invoice is validated; its lines can no longer change.
```

A rule describes the data, not the person writing, so `$currentUser` is refused in a rule. To keep a record from some people, use row-level permissions; to free a role from a rule, list it in `exemptRoles`.

## Transition

A transition lists the moves a `single-select` or `status` field may make, from the value it holds to the value a write sends.

```yaml
rules:
  - name: invoice-status-flow
    kind: transition
    field: status
    initial: [draft]
    allow:
      - { from: draft, to: [validated] }
      - { from: validated, to: [paid, draft] }
      - { from: '*', to: [cancelled] }
    message: An invoice moves draft → validated → paid.
```

A change no entry allows is refused. A write that leaves the field out, or sends the value it already holds, passes. `*` as a `from` stands for any value, an empty field included. With `initial`, a new record must start on one of its values, and the field's `default` must be one of them.

<!-- sovrium:options TransitionRuleSchema -->

## Validate

A validation states a condition, `require`, the record must meet once the write is applied: the stored record with the change on an update, the new record on a create. With `if`, it applies only to a record that matches `if` after the write. `message` is required.

```yaml
rules:
  - name: validated-needs-lines
    kind: validate
    on: [update]
    if: { field: status, operator: eq, value: validated }
    require: { field: line_count, operator: neq, value: 0 }
    message: A validated invoice needs at least one line.
```

A value computed from other records (the number of lines, a total) is read through a `count` or `rollup` field of the table. A rule cannot yet compare a value with the one it replaces (« the amount may only decrease »).

<!-- sovrium:options ValidateRuleSchema -->

## What a refused write returns

The records API answers `400` with code `VALIDATION_ERROR`, the first broken rule's message, its `rule` name and the `field` it is about, and lists every broken rule in `errors`:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "The invoice number can't change after validation.",
  "field": "number",
  "rule": "invoice-frozen-once-validated",
  "errors": [
    {
      "rule": "invoice-frozen-once-validated",
      "field": "number",
      "message": "The invoice number can't change after validation."
    }
  ]
}
```

`field` is left out when the caller may not read it (a read her role or one of her groups grants counts, the same on a single write and a batch) and when a rule refuses a delete, which concerns the whole record rather than one field. A batch create, update, delete or restore, an upsert and a bulk form are all or nothing: one broken rule writes no row, and each entry of `errors` carries the `index` of its row in the request and, when it exists, its `recordId`. A CSV import that overwrites is an upsert: one refused row writes nothing of its chunk, and the `400` lists that row the same way. The MCP tools answer an invalid-params error carrying the same message; an automation step fails with the message and is not retried, whatever its `retry` policy; the AI chat reports the message in its reply; a hosted form's edit answers `400` with the message, which the form shows beside the refused field.

## What a reader may still change

On a table that declares rules, a record read through the records API carries a `_locks` block beside its `fields` when something is locked for the reader:

```json
"_locks": {
  "fields": ["number", "amount"],
  "delete": true,
  "deleteReason": "A paid invoice is kept for the accounts; it cannot be deleted.",
  "next": { "status": ["paid", "draft"] },
  "reasons": { "number": "The invoice number can't change after validation." }
}
```

`fields` is `"*"` when every field she can write is locked. `deleteReason` is the message a delete would be refused with. `next` lists, for each field a transition moves, the values the record may move to. The block is decided for the reader (a rule exempting her role locks nothing for her) and never names a field she may not read. A single-record read judges every rule; a list judges the rules that read the record's own columns only, so a lock that depends on a related record shows on the record's own read. Forms, the record drawer, the grid, the board and the calendar read it to disable what would be refused. An edit form draws a locked field disabled with the rule's message beside it, or, when a lock holds the whole record, says the message once above its fields and draws every control and its submit disabled; it offers a transition field only its allowed moves; the drawer shows a locked field as its value with the message; the grid opens no editor on a locked cell, refuses a fill that crosses one, and draws the delete action of a record that cannot be deleted disabled, with the message as its tooltip; the board does not let a locked card be dragged, and puts a card whose drop is refused back in the lane its record holds; the calendar keeps a locked event on its day. The hint can be out of date, since the record may have changed since it was read, so every save is still judged, and a refusal shows the rule's message beside the field it names, in the drawer, or as a toast on the board and the calendar.

## Migrating from `conditions`

Up to 0.45 a `single-select` field could lock its record with `conditions: [{ when: completed, then: { readOnly: true } }]`. The key is refused from 0.46; declare the lock on the table:

```yaml
rules:
  - name: order-frozen-once-completed
    kind: lock
    when: { field: status, operator: eq, value: completed }
```

The lock applies on every way a record is written, and binds admins too unless `exemptRoles` names their role. See [Upgrade and Roll Back](/en/docs/upgrade-rollback).
