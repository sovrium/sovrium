# Table Retention

> Keep a table to a fixed window — which rows a daily sweep deletes, when it runs, and what it leaves alone — and keep a busy table out of the activity log.

Add `retention` to a table whose rows only ever accumulate — an event log, the results of a periodic check, an imported feed — and its oldest rows are deleted for good once a day. Without it, rows are kept until someone deletes them.

<!-- sovrium:options TableRetentionSchema -->

```yaml
tables:
  - id: 1
    name: events
    fields:
      - { id: 1, name: message, type: long-text }
      - { id: 2, name: received_at, type: datetime }
    retention:
      field: received_at
      days: 30
  - id: 2
    name: uptime_checks
    fields:
      - { id: 1, name: status, type: single-line-text }
    retention:
      days: 7
```

## Which rows go

A row is deleted once its `field` falls before the start of the day `days` days ago, counted on the calendar of the operator timezone (`SOVRIUM_TIMEZONE`, UTC when unset). With `days: 30`, a sweep on 1 October keeps every row from 1 September onwards. A `date` field is compared on its day. A row whose field is empty is kept.

`field` names a `date`, `datetime`, `created-at` or `updated-at` field of the table, or the table's own `created_at` or `updated_at`. Left out, the window counts from `created_at`, the moment the row was created. Any other field, or a name the table does not have, is refused when the configuration is loaded, and so is a `days` that is not a whole number from 1 to 36500.

## What the sweep does

- **It deletes for good.** The rows are removed from the database, not moved to the trash, and cannot be restored. A row already in the trash is deleted when it falls out of the window like any other; a trashed row still inside it stays in the trash and can be restored as usual.
- **It is quiet.** Deleting by retention starts no record automation, sends no table webhook and writes no entry in the record history. The server log gets one line per table with the number of rows deleted.
- **It respects links.** A row that another table still points at through a relationship whose `onDelete` is `restrict` is kept, and counted as kept in that log line. Under `cascade` or `set-null`, the linked rows follow the relationship's rule.
- **It works in batches.** However large the backlog — the first sweep after you add `retention` to a table that has grown for a year — one sweep removes it, a bounded number of rows at a time, so the database is never held by one huge delete.

The sweep runs daily at 03:30 in the operator timezone. It does not run at startup, and there is no endpoint to run it early: a row is deleted by its age, not by a request. Running it twice on the same day deletes nothing the second time.

On SQLite, deleted rows free space inside the database file for new rows; the file itself only shrinks after a `VACUUM`.

## Keeping a table out of the activity log

Every create, update, delete and restore of a record writes an entry in the activity log, with the values before and after — often more bytes than the record itself. For a table of machine-written rows nobody audits one by one, set `activityLog: false`:

```yaml
tables:
  - id: 1
    name: events
    fields:
      - { id: 1, name: message, type: long-text }
    activityLog: false
```

Writes to that table then leave no activity entry, so its records show in neither the activity log nor a record's history. Every other table, and the app's sign-ins and administrative actions, are recorded as before. Turn it off only where no one will need to ask who changed a row.
