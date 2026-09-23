# Form Availability

> When a form accepts answers — an opening date, a closing date, a submission cap, and the page a closed form shows.

Registration opens Monday. The workshop seats forty. The survey closes at the end of the quarter. Each of those is a rule about _when_ a form accepts answers, and each one otherwise becomes a calendar reminder to go and edit the configuration by hand.

```yaml
forms:
  - id: 1
    name: workshop-signup
    title: Spring Workshop
    submitTo: { table: registrations }
    availability:
      opensAt: '2026-03-01T09:00:00Z'
      closesAt: '2026-03-20T23:59:59Z'
      maxSubmissions: 40
    fields:
      - { kind: table-field, column: email, required: true }
```

## Properties

<!-- sovrium:options FormAvailabilitySchema -->

Every property is optional; omit the block and the form is open, indefinitely, with no cap. Both timestamps are ISO 8601, and `maxSubmissions` is a positive integer — the submission after the cap is refused.

When both timestamps are set, `opensAt` must be strictly before `closesAt`. A window that closes before it opens accepts nothing and is almost always a typo, so it fails when the configuration is decoded, naming the form and both timestamps.

## What a closed form answers

Opening a closed form is not an error — the visitor gets a page explaining the situation. Posting to one is refused with a structured body, so a programmatic client can tell the three cases apart.

| State           | Opening the form   | Posting | `error` slug               | Extra keys                       |
| --------------- | ------------------ | ------- | -------------------------- | -------------------------------- |
| Before it opens | Closed page        | `403`   | `form not yet open`        | `opensAt`                        |
| After it closes | Closed page        | `403`   | `form closed`              | `closedAt`                       |
| At the cap      | Form still renders | `403`   | `submission limit reached` | `maxSubmissions`, `currentCount` |

Those are the parts that differ. All three also carry the canonical error envelope every other API error uses — a success flag, a human-readable message and a code — so one decoder handles all of them and the slug is only needed to tell the three apart.

```json
{
  "success": false,
  "error": "form not yet open",
  "message": "This form is not accepting submissions yet",
  "code": "FORBIDDEN",
  "opensAt": "2026-04-01T09:00:00Z"
}
```

A refused submission writes nothing: no ledger row, no table row, no automation run.

## The closed page

Left unconfigured it shows the form's own title and a sentence explaining that the form is not yet open — quoting the date — or no longer accepting answers. `closedPage` replaces that with your own copy and, optionally, a way forward.

```yaml
availability:
  closesAt: '2026-03-20T23:59:59Z'
  closedPage:
    title: Registration has closed
    message: Spring places are full. The autumn cohort opens in July.
    cta:
      label: Join the waiting list
      href: /waiting-list
```

`cta.label` and `cta.href` are required together; neither alone renders a link. The same page serves all three closed states, so write copy that reads sensibly whether the form has not opened yet or has filled up.

## Only a real submission consumes a slot

A submission rejected as spam — a tripped honeypot, a rate-limit miss — and one that failed downstream never count toward the cap. A bot cannot exhaust forty workshop seats in a burst, and a failed write does not quietly cost a genuine registrant their place.

The cap is also enforced atomically, so concurrent submissions racing for the last slots cannot overshoot it. That matters precisely at the moment a cap is interesting: a popular form fills its last places in the same second.
