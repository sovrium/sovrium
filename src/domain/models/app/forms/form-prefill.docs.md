# Form Prefill

> Seeding fields at render time from the URL query string, the signed-in user, or a literal — declared once in a map.

A form that already knows the answer should not ask for it. The campaign that sent the visitor is in the URL; the signed-in user's email is in the session. Asking anyway costs a field, and the answer you get back is worse than the one you already had.

`prefill` maps field names to where their initial value comes from.

```yaml
forms:
  - id: 1
    name: lead-capture
    title: Request a demo
    submitTo: { table: leads }
    prefill:
      utm_source: $query.utm_source
      utm_campaign: $query.utm_campaign
      plan: Starter
    fields:
      - { kind: table-field, column: email, required: true }
      - { kind: standalone, name: plan, inputType: short-text }
      - { kind: standalone, name: utm_source, inputType: short-text, hidden: true }
      - { kind: standalone, name: utm_campaign, inputType: short-text, hidden: true }
```

`prefill` is an open map — the keys are your own field names — so there is no fixed option table for it. Every value is either a reference or a literal, and references resolve server-side while the form is being rendered.

| Source                  | Resolves to                                                    | When it cannot resolve                 |
| ----------------------- | -------------------------------------------------------------- | -------------------------------------- |
| `$query.<name>`         | The named query-string parameter of the rendering request      | Entry dropped; the field renders empty |
| `$user.<prop>`          | A property of the signed-in user, such as `$user.email`        | Entry dropped; the field renders empty |
| String, number, boolean | Itself, verbatim — a plain default the submitter can overwrite | —                                      |

An unresolvable reference is removed from the map rather than rendered, so the literal text `$query.utm_campaign` never leaks into the HTML.

## Prefilled hidden fields

A prefill on a hidden field is the point of the feature for attribution work. The field renders as a hidden input carrying the resolved value, so the campaign the visitor arrived on rides into the record without ever appearing on screen, and without a hand-written tracking script.

```yaml
prefill:
  campaign: $query.ref
fields:
  - { kind: table-field, column: email, required: true }
  - { kind: table-field, column: campaign, hidden: true }
```

A request carrying `?ref=partner-x` now stores `partner-x` in the record's campaign column.

## `$user` needs a session

A user reference resolves only when the request carries an authenticated session, which in practice means the form requires one. On a public form the reference simply drops and the field renders empty — no error, and no leaked session state.

That tolerance is specific to this map. A per-field `defaultValue` referencing the user on a public form is a configuration mistake rather than a runtime shrug, and it is refused when the configuration is decoded, naming the form and the field. Either require authentication, or move the reference here.

## `$parent` and `$record` do not resolve here

The schema accepts them, but this map is resolved against the **request** — the query string and the session — and knows nothing about a host record. A token it does not recognise passes through as a literal string, so a parent reference written here renders its own characters into the field.

Parent-record prefill belongs on the page's form control, where a host record actually exists.

## Prefill or `defaultValue`

Both seed an initial value and both accept the same references. The choice is about where the wiring lives.

| Reach for      | When                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------- |
| `prefill`      | Attribution and session seeding — the wiring is a concern of the form and reads better together |
| `defaultValue` | A value that is part of the field's own definition, such as a starting quantity                 |
