# Date Actions

> Timezone- and locale-aware date work inside an automation — eight operators over a closed token set, and the omissions that keep it eight.

Render an instant, read one back out of a string, shift it, measure between two, snap to a calendar boundary.

```yaml
- name: dueLabel
  type: date
  operator: format
  props:
    input: '{{trigger.data.dueAt}}'
    pattern: "EEEE d MMMM yyyy 'at' HH:mm"
    timezone: Europe/Paris
    locale: fr-FR
```

## The operators

| Operator   | Required props               | Optional props                  | Output                                        |
| ---------- | ---------------------------- | ------------------------------- | --------------------------------------------- |
| `format`   | `input`, `pattern`           | `timezone`, `locale`            | `{ formatted }`                               |
| `parse`    | `input`, `pattern`           | `timezone`                      | `{ instant, valid }`                          |
| `add`      | `input` plus a duration part | `timezone`                      | `{ instant }`                                 |
| `subtract` | `input` plus a duration part | `timezone`                      | `{ instant }`                                 |
| `diff`     | `from`, `to`, `unit`         | `timezone`                      | `{ value }`                                   |
| `startOf`  | `input`, `unit`              | `timezone`                      | `{ instant }`                                 |
| `endOf`    | `input`, `unit`              | `timezone`                      | `{ instant }`                                 |
| `now`      | none                         | `pattern`, `timezone`, `locale` | `{ instant }`, and `formatted` with a pattern |

<!-- sovrium:options DateActionSchema -->

`instant` is always an ISO 8601 **string**, never a date object: a step output is persisted to run history as JSON, re-read by templates and returned in webhook bodies, and an object survives none of those hops with its type intact.

`timezone` is an IANA identifier and defaults to `UTC`. An instant carries no zone of its own — `timezone` is what the instant is _read in_. A fixed offset is accepted but cannot express daylight saving, so prefer a named zone anywhere that observes it. `locale` is a BCP-47 tag defaulting to `en-US`, and it affects only the month and weekday **name** tokens; a purely numeric pattern ignores it.

## The pattern token set is closed

| Token  | Meaning                        | Parseable |
| ------ | ------------------------------ | --------- |
| `yyyy` | Calendar year, four digits     | yes       |
| `MM`   | Month, two digits              | yes       |
| `dd`   | Day of month, two digits       | yes       |
| `HH`   | Hour, two digits, 24-hour      | yes       |
| `mm`   | Minute, two digits             | yes       |
| `ss`   | Second, two digits             | yes       |
| `MMMM` | Month name, full, localised    | no        |
| `MMM`  | Month name, short, localised   | no        |
| `EEEE` | Weekday name, full, localised  | no        |
| `EEE`  | Weekday name, short, localised | no        |
| `YYYY` | Legacy alias of `yyyy`         | yes       |
| `DD`   | Legacy alias of `dd`           | yes       |

An unrecognised token is an **error**, not a pass-through. Every ASCII letter outside a quoted literal must belong to a token above, which is the format's own rule — letters are reserved. Quote a literal letter: `"yyyy-MM-dd'T'HH:mm:ss"`. Non-letters pass through untouched.

Closing the set is what keeps this surface finite and testable. The moment a forty-token vocabulary is implied, all forty are owed.

The four **name** tokens are not parseable, so `parse` takes no `locale` and a pattern containing `MMMM` or `EEEE` is refused on the parse side. A localised month name is ambiguous across languages and abbreviation styles, and accepting it would be guesswork rather than parsing.

## `parse` reports validity as data

```yaml
- name: readDueDate
  type: date
  operator: parse
  props:
    input: '{{trigger.data.dueDate}}'
    pattern: dd/MM/yyyy
    timezone: Europe/Paris
```

A string that does not match the pattern **succeeds** the step with `valid: false` and a null instant, rather than failing it. Two behaviours depend on that:

- **Retry.** A failed step is retried per its retry policy. Retrying a deterministic verdict burns the budget and delays the run for a result that cannot change.
- **Control flow.** A failed step stops the branch unless `continueOnError` is set, so a downstream filter meant to route the invalid rows would never run. Returning data keeps the decision where an author can act on it.

A malformed **pattern** is the opposite case — an author error rather than data — and does fail the step.

```yaml
- name: routeInvalid
  type: filter
  operator: continue
  props:
    condition:
      conditions: [{ field: '{{readDueDate.valid}}', operator: equals, value: true }]
    onFalse: skip
```

## Calendar units and elapsed time are different

`add` and `subtract` take at least one duration component; declaring none is a configuration error. The counts are plural while unit names elsewhere are singular — quantities against names.

| Component | Resolved as                                                 |
| --------- | ----------------------------------------------------------- |
| `years`   | **Calendar** — daylight-saving aware, wall clock preserved  |
| `months`  | **Calendar** — 31 January plus one month is 28 February     |
| `weeks`   | **Calendar** — daylight-saving aware                        |
| `days`    | **Calendar** — a day across a change is 23 or 25 real hours |
| `hours`   | **Elapsed** — always 60 minutes                             |
| `minutes` | **Elapsed** — unaffected by daylight saving                 |
| `seconds` | **Elapsed** — unaffected by daylight saving                 |

Adding `{ days: 1 }` to noon in a zone that springs forward lands on noon the next day, 23 real hours later. Adding `{ hours: 24 }` lands on 13:00, 24 real hours later. Both are correct answers to different questions, and the split is what keeps an `add` in hours and a later `diff` in hours agreeing.

Larger units apply before smaller ones, so month-end clamping happens first: 31 January plus one month and six hours clamps to 28 February and then adds the hours.

## `diff` is signed and truncated toward zero

```yaml
- name: daysLate
  type: date
  operator: diff
  props:
    from: '{{trigger.data.dueAt}}'
    to: '{{now.instant}}'
    unit: day
    timezone: Europe/Paris
```

`unit` is singular: `year`, `month`, `week`, `day`, `hour`, `minute`, `second` or `millisecond`. The result is negative when `to` precedes `from`, and truncated toward zero, so a 47-hour gap is one day rather than two. Calendar units are counted against the zone; elapsed ones are not.

Because the answer carries a sign, there are no comparison operators in this family — compare the result in a filter or a branch condition instead.

## `startOf` and `endOf`

```yaml
- name: monthStart
  type: date
  operator: startOf
  props:
    input: '{{trigger.data.occurredAt}}'
    unit: month
    timezone: Europe/Paris
```

`unit` is the same singular vocabulary as `diff` minus `millisecond`, which no boundary snaps to. The boundary is computed in `timezone`, so the start of a day in a European zone is 22:00 or 23:00 UTC the evening before, depending on the season.

## What is deliberately absent

The eight operators were chosen against a capability domain rather than against a date library's API surface, so several familiar names are missing on purpose:

- **Comparisons** belong in a filter or branch condition; `diff` already returns a signed answer.
- **Timezone conversion** would teach a wrong model, since an instant carries no zone. `format`'s `timezone` covers the real need.
- **Weekday predicates** are `format` with `EEEE` plus a filter. Three operators for one token is the per-library sprawl this family exists to avoid.
- **Epoch conversion** is a token-set question, not an operator question.
- **Business-day and holiday arithmetic** needs a calendar the platform does not have, and a wrong answer here is worse than none.

## From a code action

Every operator is reachable as `context.actions.date.<operator>(props)`. That path does not decode props against the schema, so the handler re-applies the guards itself: an invalid timezone or an unrecognised token fails there exactly as it would at boot.
