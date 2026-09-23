# Anti-Spam, Attribution & Analytics

> Keeping junk out of a public write endpoint, recording who submitted, and excluding a form from aggregate reporting.

A public form is a public write endpoint. Left open it collects bot submissions and the useful ones drown. Two small blocks handle that: `antiSpam` keeps junk out, and `analytics` decides whether the form feeds aggregate reporting at all. Attribution needs no configuration.

```yaml
forms:
  - id: 1
    name: contact
    title: Contact Sales
    submitTo: { table: leads }
    antiSpam:
      honeypot: true
      rateLimit: { perIp: 5, perForm: 500, windowSeconds: 60 }
    analytics:
      enabled: false
    fields:
      - { kind: table-field, column: email, required: true }
```

## Anti-spam

<!-- sovrium:options AntiSpamSchema -->

<!-- sovrium:options RateLimitSchema -->

Every property is optional and every default is protective: a form with no `antiSpam` block is already defended. The honeypot is on, and the limits are 10 submissions per IP and 1000 for the whole form, over a rolling 60-second window.

The honeypot is a conventionally named hidden input carrying every marker that keeps a human out of it — hidden from assistive technology, out of the tab order, with autocomplete off and no visible box. A person never sees it or tabs into it; a naive bot that fills every input in the document trips it immediately.

### How a rejection looks

| Trigger                 | Response                   | Ledger status and reason       |
| ----------------------- | -------------------------- | ------------------------------ |
| Honeypot filled         | `400`, "invalid request"   | `spam` / `honeypot`            |
| Per-IP limit exceeded   | `429` with a `Retry-After` | `spam` / `rate_limit_per_ip`   |
| Per-form limit exceeded | `429` with a `Retry-After` | `spam` / `rate_limit_per_form` |

The client is told nothing specific, because a bot that learns **why** it was refused learns how to get past. The reason is recorded on the ledger row instead, where a moderator can review it.

A spam-flagged submission never writes to the bound table, never fires the submit automation, and never counts against the availability cap. The submitter's address is stored only as a salted hash; the raw address is never persisted.

### A partial block does not turn the rest off

Omitting `antiSpam` entirely still renders the honeypot and still enforces the per-IP limit. Writing a block that sets only the rate limit does **not** replace the honeypot default — it adds to it. To genuinely disable the trap you have to say so with `honeypot: false`.

A test form that posts repeatedly from one address is the usual way this surprises people.

## Attribution

When a session is present the ledger records the submitter's user id, and a bound table's created-by column is populated.

There is no configuration for "one submission per person". To enforce that, put a unique constraint on the bound table's column — the database is the only place a uniqueness rule cannot be raced.

## Analytics opt-out

<!-- sovrium:options FormAnalyticsSchema -->

Every successful submission feeds the aggregate analytics stream by default, which is what lets the operator console chart submissions per day and drop-off per step.

Set `enabled: false` on a form carrying data that must not appear in cross-submission aggregates — health intake, payment details, anything under legal hold. Per-submission inspection in the console is unaffected: the opt-out removes the form from the _aggregate_, not from your records.

Aggregation is gated three times over — an operator-level environment switch, the app-wide analytics block, and this per-form flag. Any one of them off is enough to keep a form out, which is the right direction for a switch whose failure mode is publishing something.
