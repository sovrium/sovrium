# Form Fields

> The five field kinds a form's `fields` array holds — bound to a table column, typed inline, computed, a divider, or a signature.

`fields` is an ordered list rendered top to bottom. Each entry is one of five kinds, discriminated by `kind`.

| Kind          | What it is                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------- |
| `table-field` | Bound to a column on the submit target; type, validation and persistence flow from the table |
| `standalone`  | Typed inline through `inputType`, and not written to a column directly                       |
| `calculation` | A read-only value computed from other fields, recomputed as they change                      |
| `section`     | A visual divider with an optional heading; renders no input                                  |
| `signature`   | Captures a drawn or typed signature                                                          |

```yaml
forms:
  - id: 1
    name: signup
    title: Create your account
    submitTo: { table: users }
    fields:
      - { kind: table-field, column: email, required: true }
      - { kind: standalone, name: newsletter, inputType: checkbox, label: Subscribe to updates }
```

## Table-bound fields

A `table-field` names a `column` on the submit target. The field type, its validation and its persistence all come from the table schema — the form supplies display concerns, plus upload options for an attachment column.

<!-- sovrium:options TableBoundFieldSchema -->

```yaml
fields:
  - kind: table-field
    column: subject
    label: What can we help with?
    placeholder: Briefly describe the issue
  - kind: table-field
    column: priority
    helpText: Urgent issues are triaged first
```

An attachment column renders a file input automatically, and a `relationship` column renders a dropdown of the related table's rows — labelled by the column's `displayField`, storing the row id. A visible relationship field whose column declares no `displayField`, and which names no `optionsSource`, is refused at load: there is nothing to label its choices with. A `currency` column renders a number input with the currency's symbol beside it, stepped by the column's `precision` (or the currency's own decimals — a cent for EUR) and opening a decimal keypad on a phone; a `percentage` column renders a number input with `%` after it, bounded by the column's `min` and `max`, and stores the value on its 0 to 100 scale. The symbol is never part of the value sent or stored. A `rating` column renders a radio group of one choice per rank up to its `max`; choosing the chosen rank again clears it, and an unanswered rating stores no value rather than 0. A hosted form draws these exactly as a page `form` component does.

Every required field — required by the field, by its column, or by a `requiredWhen` rule that holds — shows a required mark beside its label and is announced as required to assistive technology.

A checkbox stores `true` when it is ticked and `false` when it is not — never an empty value. A browser posts a ticked box as `on`; `on`, `true` and `1` all mean ticked, and `false`, `0` or a box left out of the submission mean unticked. A **required checkbox must be ticked**: it is the shape a consent takes, so a submission that posts it unticked, or leaves it out, is refused with `400`, naming the box, and nothing is stored.

## Standalone fields

Typed inline, and not written to a column. This is the kind for a form that routes to an automation or lives only in the ledger.

<!-- sovrium:options StandaloneFieldSchema -->

`inputType` is one of `short-text`, `long-text`, `email`, `url`, `phone`, `number`, `date`, `datetime`, `select`, `multi-select`, `checkbox`, `radio`, `rating` or `attachment`. `name` is unique within the form.

A standalone `phone` field draws a telephone input, a `datetime` field a date-and-time picker, and an `attachment` field a file picker.

```yaml
fields:
  - kind: standalone
    name: rating
    inputType: rating
    label: How was your experience?
    required: true
  - kind: standalone
    name: source
    inputType: select
    label: How did you hear about us?
    options:
      - { value: search, label: Search engine }
      - { value: referral, label: Referral }
```

### A dropdown opens on an empty choice

A dropdown — standalone `select` or `multi-select`, or a table-bound select column — opens on a leading empty choice labelled by the field's `placeholder`. Without one the browser applies its own rule, which is to select the first entry, and the field then reads as answered before the visitor has touched the page.

That empty choice is what makes the two obvious behaviours actually hold:

- A **required** dropdown refuses to submit until the visitor picks something. Without it, `required` could never bite.
- An **optional** dropdown left alone stores **no value at all**, rather than its first option.

A value that already resolves — a default, or a prefill arriving from a query parameter — still wins outright and is never asked for twice. A free-text field is unaffected: an empty text box still stores an empty string. An empty email, link or phone number is no answer, and stores no value.

## Choices read from a table

A choice field whose options live in a table — programmes, channels, campuses — names that table with `optionsSource` instead of copying the rows into `options`. It works on a standalone `select`, `multi-select` or `radio` field, in place of `options` (the two are mutually exclusive), and on a `table-field` over a `relationship` column, where it overrides the related table's rows. `displayField` is the column shown and `valueField` (default `id`) the column stored; `filter`, `sort` and `limit` (default 100, at most 1000) narrow the list. The rows are read on the server every time the form is served — on its own page, on each step of a multi-step form, and wherever a page or a dialog embeds it with `formRef` — so a row added to the table is offered on the next load, and the browser never calls the records API for them.

The rows are read with the form's own authority, not the visitor's, so a public form needs no read permission on the table — and should not be given one, since that would open every column through the records API. What the form exposes instead is exactly the `displayField` and `valueField` of the rows its `filter` selects, readable by anyone who can open the form. That exposure is checked at load: a column whose read the table restricts in `permissions.fields` is refused, as is a column of a sensitive type (`email`, `phone-number`, `long-text`, `rich-text`, an attachment, `user`, or a `created-by` / `updated-by` / `deleted-by` stamp), and a `filter` referencing `$currentUser` is refused on a form without `access.require`, because nobody is signed in to resolve it. Unknown tables and columns, and `optionsSource` on an input that offers no choices, are refused too, each naming the form and the field. The refusal follows lookup, rollup and formula columns to the column they read: a lookup or rollup of an email address, of a column the related table restricts, or a formula naming a phone number is refused just as the column itself would be, and the error names both. A table that declares no `permissions.fields` is still held to the engine's built-in read rules — a column they hide from a signed-in `member` or `viewer` is refused as a label or a value (unless the form's `access.require` admits neither role); declaring the table's own `permissions.fields` replaces those rules. A relationship field's default choices (its `relatedTable` and `displayField`) are held to the same checks as an explicit `optionsSource`.

The table's row-level read rule is the one part of the read that stays the visitor's: a choice is a row, and each visitor is offered only the rows the rule shows them, exactly as the records API lists them — on the form's own page, on each step and in a `formRef` embedding alike. A rule naming no one, such as `status = published`, applies to a visitor who is not signed in as to anyone else; a rule naming the signed-in person (`$currentUser.…`) shows such a visitor no row. So a public form whose choices come from a table with a rule like `owner_id = $currentUser.id` offers an anonymous visitor no choice at all; to offer them rows, give the table a read rule that admits those rows without naming the visitor, or take the choices from a table without one. Publishing a form publishes its choices, even from a table its visitor may not otherwise read, and the table's row-level read rule still filters them, for the choices offered and the links submitted alike.

A submission is held to the same rows. A value submitted for a relationship field that names a row outside the rows the form offers its submitter — those its `filter` selects, under the related table's row-level read rule for the submitter, signed in or not; evaluated when the form is submitted, a `$currentUser` reference resolved for the signed-in submitter — is answered exactly as a row that does not exist, with the field's error, and nothing is stored. A row the rule hides from the submitter and a row that was never there get the same answer. The `sort` and `limit` shape the list drawn on the page; they do not narrow what may be submitted. A hidden relationship field draws no list, but its value is submitted like any other, so it is held to the rows it would offer: its `optionsSource`, else every live row of the related table. A field declared `hidden: true` on the form is held more tightly still: it accepts only a value the server would have filled in for the person submitting — the form's own literal or `$user` prefill, or the record of a page that embeds the form and that they may open — and anything else is answered as a missing row. The exception is a field the form fills from the query string (`$query.<name>`): the visitor writes the URL, so that link is held only to the rows it would offer. The prefill page describes the rule in full.

```yaml
fields:
  - { kind: table-field, column: programme, required: true }
  - kind: standalone
    name: track
    inputType: select
    label: Preferred track
    optionsSource:
      table: programmes
      displayField: name
      valueField: code
      filter: [{ field: active, operator: eq, value: true }]
      sort: [{ field: name, direction: asc }]
```

## Calculation fields

<!-- sovrium:options CalculationFieldSchema -->

```yaml
fields:
  - { kind: standalone, name: quantity, inputType: number, label: Quantity }
  - { kind: standalone, name: unit_price, inputType: number, label: Unit price }
  - kind: calculation
    name: total
    label: Total
    formula: '{{round (multiply quantity unit_price) 2}}'
    format: currency
```

A calculation shows a read-only value computed from other fields of the same form, and recomputes it in the browser as those fields change. The formula is one template expression in the same `{{...}}` grammar automations use — a field name on its own, or a number helper applied to field names, numbers or another helper call in parentheses. The helpers are `add`, `subtract`, `multiply`, `divide`, `modulo`, `round`, `ceil`, `floor`, `abs`, `min`, `max`, `clamp` and `percentage`; they compute what their automation namesakes compute, except that `round` gives a number rather than text. Dividing by zero gives `0`. There is no second formula language to learn.

The value stays empty until every field it reads holds a number. `format: currency` shows it with two decimals and `format: percent` draws a `%` beside it; `number` and `text` show it as computed.

A formula naming a field the form does not have, a helper outside the number family, or another calculation that in turn depends on this one, fails when the configuration is decoded, naming the form and the field.

The computed value is submitted with the other answers and stored in the submission under the field's `name`; it is not written to the bound table. The browser's arithmetic is never trusted on its own: the server recomputes every calculation from the submitted inputs (one that reads another is computed after it), fills in a value the submission left out, and refuses a submission whose value disagrees with `400` and a field error naming the calculation, writing nothing.

## Section and signature fields

<!-- sovrium:options SectionFieldSchema -->

<!-- sovrium:options SignatureFieldSchema -->

A section renders its `heading` as a heading and its `description` as a paragraph beneath it, at the position it is declared, carries an optional whole-section visibility rule, and adds nothing to what the form submits. On a one-question or multi-step form, a section is shown with the field declared after it.

## Help text and descriptions

`helpText`, a form's `description` and a step's `description` accept a small inline subset of markdown — `[label](/path)`, `**bold**`, `_italic_`, `` `code` `` and line breaks — so guidance can link to a page instead of printing its URL. Links always open in a new tab, so following one never loses a half-filled form; relative, `http(s)` and `mailto:` targets are kept and anything else is neutralised. Headings, lists and images are not rendered, raw HTML never reaches the page, and a `$t:` key is translated before it is rendered. The page's meta description keeps the same words without the markup.

```yaml
fields:
  - kind: table-field
    column: source
    label: Campaign ID
    helpText: 'Which ID? See [Channels](/channels) — use the **numeric** one.'
```

## Defaults and references

A field's `defaultValue` is a literal, or a reference resolved at render time — a URL query parameter, or a property of the signed-in user.

The top-level `prefill` map does the same job with the wiring kept in one block. The two differ in one way that matters: on a **public** form a per-field default referencing the signed-in user is refused when the configuration is decoded, naming the form and the field, while the prefill map tolerates the reference and drops it. Require authentication, or move the reference into `prefill`.

## Inline relationship create

When a form is placed on a parent record's page — a "new ticket" button on a project page — a parent reference ties the new child back to its parent automatically. It is configured on the page's form control that embeds the top-level form with `formRef` — the only way to add a record from inside an app page — whether that control sits on the page, in a tab panel or in a dialog.

<!-- sovrium:options InlinePrefillSchema -->

`lockPrefill` hides the prefilled fields and prevents an override; they are still validated server-side. It defaults to `false`.

```yaml
pages:
  - id: 1
    name: project-detail
    path: /portal/projects/:id
    components:
      - type: form
        formRef: new-ticket
        inlinePrefill:
          prefill:
            project_id: $parent.id
            reporter_id: $user.id
          lockPrefill: true
```

On submit the engine revalidates that the parent still exists, is not in the trash and may still be read by the person submitting, which is what defends against a stale reference in a page left open. A parent that fails any of the three is answered `422`, exactly as one that does not exist. Both single and multi-relationship columns are supported.
