# Date & Time Fields

> The seven date and time field types — date, datetime, time, duration, and the system audit timestamps created-at, updated-at and deleted-at.

Seven field types store dates, times, durations and system-managed audit timestamps. All of them also accept the base field properties every field type shares.

| Type         | Stores                                                    |
| ------------ | --------------------------------------------------------- |
| `date`       | A calendar date, with optional time component.            |
| `datetime`   | A date plus time, timezone-aware.                         |
| `time`       | A time of day without a date.                             |
| `duration`   | An elapsed-time / work-hours value, stored in seconds.    |
| `created-at` | System-set timestamp captured when a record is created.   |
| `updated-at` | System-updated timestamp refreshed on every modification. |
| `deleted-at` | Soft-delete timestamp; `NULL` means the record is active. |

An empty string, or one holding only spaces, written to a date, a datetime or a time — through the API, as a default, or in a seed file — stores no value: the field reads null.

## `date`

Calendar dates, optionally carrying a time component.

A date is shown in the page's language and on its own calendar day for every reader, whatever their time zone.

A `date` field reads as its day, `YYYY-MM-DD`, on every database: on a record, on a list, in an export, as the name of a group, in what an automation reads, and in a webhook's previous values.

`weekday: short` prints the day of the week before the date — "Thu 24 Sept 2026" — and `weekday: long` writes both out — "Thursday, 24 September 2026" — in the page language — in the grid, a drawer, a list item's metadata and a card. A date without it prints exactly as before. A `datetime` accepts the same key.

<!-- sovrium:options DateFieldSchema -->

```yaml
- { id: 1, name: due_date, type: date }
- { id: 3, name: starts_on, type: date, weekday: short }
```

## `datetime`

A date and time together, stored timezone-aware so a value means the same instant wherever it is read.

<!-- sovrium:options DateTimeFieldSchema -->

```yaml
- { id: 2, name: starts_at, type: datetime }
```

`default: now` stamps each row with the moment it is written.

A datetime is stored as an instant and reads back in UTC, as ISO 8601 ending in `Z`; a value with no zone is taken as UTC. `CAST(<datetime> AS DATE)` in a formula reads the UTC day.

## `time`

A time of day with no date attached — opening hours, a daily cut-off.

<!-- sovrium:options TimeFieldSchema -->

```yaml
- { id: 3, name: opens_at, type: time }
```

A time reads back as `HH:MM:SS`, however it was typed: `8:05` reads `08:05:00`.

On SQLite, a datetime or a time an earlier version stored as it was typed is rewritten into these forms once, the next time the app starts. The rewrite does not change the record's `updatedAt`.

## `duration`

An elapsed time, stored in **seconds** whatever the display format. Storing the unit rather than a formatted string is what lets a duration be summed by a rollup and compared by a filter.

<!-- sovrium:options DurationFieldSchema -->

```yaml
- { id: 4, name: work_hours, type: duration, format: h:mm }
```

## System audit timestamps

`created-at`, `updated-at` and `deleted-at` are written by the engine, never by a client. `created_at` and `updated_at` carry a database default and a trigger that keeps them current; `deleted_at` is moved only by the delete and restore paths.

Do not send a value for one. Unlike the five computed types — `formula`, `rollup`, `count`, `lookup`, `autonumber` — which refuse a write outright with `Cannot write to readonly field`, these three are not on the write-path's readonly list, so a request naming one is not rejected for you and the result is not a contract this page can promise.

**You do not declare them to switch anything on.** Every table already carries `id`, `created_at`, `updated_at` and `deleted_at`: the engine adds each one automatically unless the table declares a field of that exact name. So soft delete is not something a `deleted-at` field opts into — it is how every table behaves, with `NULL` meaning active. **Records: Soft Delete and Restore** covers the behaviour itself.

Declaring one of these fields does two things instead. It suppresses the automatic column, so the one you wrote is the one that exists; and it puts the column into `fields[]`, where the rest of the configuration surface can reach it — a grid column, a form, a field-level permission.

<!-- sovrium:options CreatedAtFieldSchema -->

<!-- sovrium:options UpdatedAtFieldSchema -->

<!-- sovrium:options DeletedAtFieldSchema -->

```yaml
- { id: 5, name: created_at, type: created-at }
- { id: 6, name: updated_at, type: updated-at }
- { id: 7, name: deleted_at, type: deleted-at }
```

**Name them exactly `created_at`, `updated_at` and `deleted_at`.** The suppression above matches on the field's NAME, not on its `type`, so a field declared `{ name: archived_at, type: deleted-at }` does not replace anything: the table ends up with an `archived_at` column _and_ an automatic `deleted_at`, and every delete, restore and trash listing goes on using the second one. The `archived_at` column is then a date field that nothing writes.
