# Form Submissions

> The built-in submission ledger, its lifecycle statuses, and the transaction that keeps a ledger row from promising a record that was never written.

Every submission made on a form's own route produces a durable record. By default it lands in the built-in submission ledger — the platform's canonical "this form received an answer" log — and, where the form names a table, in that table too. The two writes are transactional. A submission made through a `formRef` embed on an app page is an in-app edit rather than an intake, and skips the ledger unless the form asks for it — see below.

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

It lives in an internal, Sovrium-managed schema, mirroring the isolation the auth tables get; you never create or manage it. Every submission on the form's own route writes one row unless the form opts out.

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

| State        | Meaning                                                                                 | Moves to                |
| ------------ | --------------------------------------------------------------------------------------- | ----------------------- |
| `received`   | Accepted and written to the ledger and the bound table                                  | `processing`, or `done` |
| `processing` | The bound automation is running, after the submission has been answered                 | `done`, or `failed`     |
| `done`       | Terminal — every write and the bound automation completed                               | —                       |
| `spam`       | Terminal — classified as spam and preserved for moderation                              | —                       |
| `failed`     | Terminal — the bound automation failed, used up its retries, timed out or was cancelled | —                       |

A spam submission is **kept**, not discarded. A classifier that throws away what it rejects gives nobody a way to find out it was wrong.

## The dual-write contract

Where the form names a table, the submission writes one row to that table **and** one ledger row inside a single transaction. If the table write fails — a constraint violation, a type error, a missing foreign key — the ledger row rolls back with it, and the submitter receives an error naming the offending column. No ledger entry is ever left behind promising a record that does not exist.

Where the form names an automation, it is invoked **after** both writes commit. An automation failure does **not** roll the writes back: the submission is recorded, the status moves to `failed`, and the automation's own retry and failure machinery applies.

The submission does not wait for that automation, nor for the record automations of the bound table. It answers as soon as both writes commit, so the form's `onSuccess` — a redirect, a success page — reaches the visitor right after the write, whatever the runs take. When an automation is invoked, the ledger row reads `processing` from the moment the submission answers until the runs end, then `done` or `failed`.

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

## Submissions made through a page embed

A form placed on an app page with `formRef` is how a reader adds a record from inside the app — a task on a project page, an interaction on a contact. Those submissions are ordinary edits, and filling the Submissions inbox with them would bury the intake it exists for. So `storeSubmission` is read by surface:

| `submitTo.storeSubmission` | On the form's own route | Through a `formRef` embed on an app page |
| -------------------------- | ----------------------- | ---------------------------------------- |
| omitted                    | stored                  | not stored                               |
| `true`                     | stored                  | stored                                   |
| `false`                    | not stored              | not stored                               |

The table row and the automation are unaffected: an embedded submission still writes to `submitTo.table` and still runs `submitTo.automation`. When no ledger row is written, `$submission.id` is empty in the success message and redirect.

```yaml
forms:
  - id: 2
    name: report-incident
    title: Report an incident
    submitTo:
      table: incidents
      storeSubmission: true # triage embedded reports in the Submissions inbox too
    fields:
      - { kind: table-field, column: summary, required: true }
```

**A capped form always stores.** A form declaring `availability.maxSubmissions` writes its ledger row on every surface, whatever `storeSubmission` says, because the cap is counted by reserving that row: a submission that wrote none could not be counted against it.

## A submission sent twice is stored once

A visitor who presses Submit twice, a script that retries after a timeout, or a browser that resends a post should not leave two submissions behind. A submission may carry an **idempotency key**: the `Idempotency-Key` request header, or a field named `_idempotency` in the submitted body. A form on its own route renders that field for you, with a new random key every time it is drawn. A form placed on a page with `formRef` gets its key from the page's script as the page loads, since a page may be served from a cache, and a new one after each successful submission. The script sends the same key as the header.

Within five minutes of a successful submission, a request from the same caller with the same key and the same values is not processed again: it receives the first answer — the same status, the same body, the same redirect for a native post — with the header `Idempotency-Replayed: true`. Nothing is stored, no row is written, no automation runs, and the duplicate counts against no limit. A duplicate that arrives while the first is still being processed waits for it and receives its answer.

| The request                                           | The answer                                                |
| ----------------------------------------------------- | --------------------------------------------------------- |
| No key                                                | Processed as a new submission, every time                 |
| A key not seen, or seen more than five minutes ago    | Processed as a new submission                             |
| A key already answered with a success, same values    | The first answer again, with `Idempotency-Replayed: true` |
| A key already answered with a success, other values   | `422` with `code: IDEMPOTENCY_MISMATCH`; nothing stored   |
| A key that is not 16 to 128 letters, digits, `-`, `_` | `400`; nothing stored                                     |

Only a success holds a key. A submission refused for a missing field leaves its key free, so the visitor who fills the field in and submits again from the same page is accepted. A key belongs to the caller who sent it: the same key from another signed-in account, or from a visitor who is not signed in and posts from another address, is a different key. The `_idempotency` field is never stored with the submission, written to the table or passed to an automation.

To make your own client safe to retry, send a fresh random key with each new submission and the same key with each retry of it:

```bash
curl -X POST https://crm.example.com/api/forms/contact/submissions \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 6f1c2a9e-3b7d-4e0a-9c41-2d5e8f7a1b30' \
  -d '{"name": "Margot Lefebvre", "email": "margot@atelier-lumen.fr"}'
```

Keys are kept in the memory of the running server: a restart forgets them, on a deployment running several server processes each process deduplicates its own requests, and once very many are held the oldest are forgotten first. An answer larger than 64 KB is not kept, so a repeat of it is processed again.

## Bypass the ledger only when you mean it

`storeSubmission: false` is the only way to skip it everywhere, and it is for a high-volume form that routes to a stream or a queue. Whenever it is set, the form must still name a table or an automation, or validation fails — a form that persists nowhere is a configuration bug rather than a choice.
