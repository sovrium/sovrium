# Form Submissions

> The built-in submission ledger, its lifecycle statuses, and the transaction that keeps a ledger row from promising a record that was never written.

Every submission produces a durable record. By default it lands in the built-in submission ledger — the platform's canonical "this form received an answer" log — and, where the form names a table, in that table too. The two writes are transactional.

```yaml
forms:
  - id: 1
    name: contact
    submitTo:
      table: leads
    fields:
      - { kind: table-field, column: email, required: true }
    onSuccess:
      type: toast
      variant: success
      message: Thanks — we will be in touch.
```

## The ledger

It lives in an internal, Sovrium-managed schema, mirroring the isolation the auth tables get; you never create or manage it. Every submission writes one row unless the form opts out.

These are the columns a top-level form's submission fills. The table is shared with the older share-link submission path, so it carries a few more that a form never writes.

| Column                | Type           | Holds                                                                                                                                 |
| --------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | text (UUID)    | The submission id, surfaced to success templates                                                                                      |
| `form_name`           | text           | The form's name at submission time                                                                                                    |
| `form_id`             | integer        | The form's id at submission time, denormalised for joins                                                                              |
| `submitted_at`        | timestamp      | When the row was created, by the server's clock                                                                                       |
| `submitter_user_id`   | text, nullable | The authenticated user, where the form requires one                                                                                   |
| `submitter_ip_hash`   | text, nullable | The submitter's address, salted and hashed — the raw address is not kept                                                              |
| `user_agent`          | text, nullable | The submitter's user-agent string                                                                                                     |
| `data`                | JSON           | The full validated payload, mirroring what the table write received                                                                   |
| `linked_record_table` | text, nullable | The bound table's name, where there is one                                                                                            |
| `linked_record_id`    | text, nullable | The id of the row the table write created, where there is one                                                                         |
| `status`              | text           | The lifecycle state below. A plain column, not a database enum                                                                        |
| `status_reason`       | text, nullable | A short reason when the status is `failed` or `spam` — `honeypot` and the two `rate_limit_*` reasons are the ones the platform writes |

## Lifecycle

| State        | Meaning                                                    | Moves to                |
| ------------ | ---------------------------------------------------------- | ----------------------- |
| `received`   | Accepted and written to the ledger and the bound table     | `processing`, or `done` |
| `processing` | The bound automation is running                            | `done`, or `failed`     |
| `done`       | Terminal — every write and the bound automation completed  | —                       |
| `spam`       | Terminal — classified as spam and preserved for moderation | —                       |
| `failed`     | Terminal — a downstream step failed and was not retried    | —                       |

A spam submission is **kept**, not discarded. A classifier that throws away what it rejects gives nobody a way to find out it was wrong.

## The dual-write contract

Where the form names a table, the submission writes one row to that table **and** one ledger row inside a single transaction. If the table write fails — a constraint violation, a type error, a missing foreign key — the ledger row rolls back with it, and the submitter receives an error naming the offending column. No ledger entry is ever left behind promising a record that does not exist.

Where the form names an automation, it is invoked **after** both writes commit. An automation failure does **not** roll the writes back: the submission is recorded, the status moves to `failed`, and the automation's own retry and failure machinery applies.

That asymmetry is the point. The writes are one unit because a half-written submission is corruption; the automation is outside it because holding a database transaction open across an HTTP call to somebody else's service is how a form takes an external outage and turns it into a lock.

```yaml
forms:
  - id: 2
    name: stream-event
    submitTo:
      automation: post-event-to-stream
      storeSubmission: false
    fields:
      - { kind: standalone, name: event_payload, inputType: long-text }
```

## Bypass the ledger only when you mean it

`storeSubmission: false` is the only way to skip it, and it is for a high-volume form that routes to a stream or a queue. Whenever it is set, the form must still name a table or an automation, or validation fails — a form that persists nowhere is a configuration bug rather than a choice.
