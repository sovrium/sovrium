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
| `$now`                  | The date and time the form was rendered                        | —                                      |
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

## Prefill from a record page

A page that shows one record — `dataSource: { mode: single }`, or a `collection` page serving one record per address — can hand that record to a form placed on it. The form control's `inlinePrefill` maps field names to values, and `$parent.<field>` (or `$record.<field>`) reads the page's record while the page renders. With `lockPrefill: true` the prefilled fields ride in hidden inputs on that page, so the visitor does not see or edit them there. The lock is presentational: it shapes this page, and a form embedded with `formRef` is also served on its own page with those fields visible. To hold a link or an account to the value the server fills in, declare the field `hidden: true` on the form — see below.

It applies to a form placed with `formRef`, the only way to add a record from inside an app page, and it works wherever that form sits — directly on the page, inside a tab panel, or inside a dialog: the parent is the page's record in all three. A page form declared in place carries no `inlinePrefill`; such a form edits the record it is bound to and has nothing to prefill.

```yaml
forms:
  - id: 1
    name: log-interaction
    title: Log an interaction
    submitTo: { table: interactions }
    fields:
      - { kind: table-field, column: summary }
      - { kind: table-field, column: person }
pages:
  - name: person-detail
    path: /people/:id
    dataSource: { table: people, mode: single, param: id }
    components:
      - type: button
        content: New interaction
        props:
          interactions: { click: { modal: log-interaction } }
      - type: dialog
        props: { id: log-interaction, title: Log an interaction }
        children:
          - type: form
            formRef: log-interaction
            inlinePrefill:
              prefill: { person: $parent.id }
              lockPrefill: true
```

A hidden relationship field that nothing fills is stored empty: the record is created with no link, never with a reference to a record that does not exist.

Beside the record tokens, the map accepts the request tokens:

| Token                                | Resolves to                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `$parent.<field>`, `$record.<field>` | A field of the page's record                                                                |
| `$now`                               | The date and time the page was rendered — just the day when the column stores a date only   |
| `$user.<prop>`                       | A property of the signed-in viewer, such as `$user.email`; dropped when nobody is signed in |

A form embedded with `formRef` keeps its own starting values — its fields' `defaultValue`s and its `prefill` map — exactly as it starts on its own page. The inline prefill overrides only the keys it names, and `lockPrefill` hides only those keys: every other field keeps its default and stays editable.

## A hidden link or account holds what the server put in it

A form field declared `hidden: true` on the form and bound to a `relationship` or `user` column accepts only a value the server itself would have rendered into it for the person submitting, worked out again when the form is submitted:

- the form's own starting value — a literal is itself, and `$user.<prop>` is the submitter's own (nothing when nobody is signed in); a field with no prefill uses its `defaultValue` under the same rules;
- the `inlinePrefill` of each page that embeds the form and names the field, when that page's `access` admits the submitter — `$parent.id` / `$record.id` any record that page reads for them, through the same read rules the page applies (the table's read grant, their groups and assigned roles, its row-level rule, records not deleted) and, on a `collection` page, only a record the collection's `filter` admits — a draft the collection leaves out is not a record its page shows, even on a table open to everyone; `$parent.<field>` / `$record.<field>` a value that field holds on such a record, when they may read the field;
- an empty value, which stores the record with no link.

Anything else is answered exactly as a record or an account that does not exist — the same error on the same field — and nothing is stored. The check runs at submission, so a page left open after the submitter lost access to its record no longer files under it.

Two cases stay open on purpose. A field the form fills from the query string (`$query.<name>`) is not held: the visitor writes the URL, so the value is theirs to choose, and the link is only held to the rows the form offers. And a field the form shows is not held, even where a page locks it, because the same form is served on its own page with that field visible. A value that must not be the visitor's choice belongs in a hidden field filled from a record page, a literal or the session.

## Prefill or `defaultValue`

Both seed an initial value and both accept the same references. The choice is about where the wiring lives.

| Reach for      | When                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------- |
| `prefill`      | Attribution and session seeding — the wiring is a concern of the form and reads better together |
| `defaultValue` | A value that is part of the field's own definition, such as a starting quantity                 |

## Autofill hints

Every field's input carries the browser autofill hint its type implies — `email` for an email field, `tel` for a phone field, `url` for a link field — and none otherwise; a field's name never implies one. `autocomplete` names another hint (`given-name`, `organization`, `postal-code`, `shipping street-address`…), and `autocomplete: off` turns autofill off for one field. The value must be an autofill detail of the HTML standard; anything else is refused when the configuration loads, naming the form and the field. A page form's fields take the same key; a `password` control gets no hint unless you name `current-password` or `new-password`.

```yaml
fields:
  - { kind: standalone, name: first_name, inputType: short-text, autocomplete: given-name }
  - { kind: table-field, column: email } # carries `email`, from the column's type
  - { kind: standalone, name: colleague_email, inputType: email, autocomplete: 'off' }
```
