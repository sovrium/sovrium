# Form Fields

> The five field kinds a form's `fields` array holds — bound to a table column, typed inline, computed, a divider, or a signature.

`fields` is an ordered list rendered top to bottom. Each entry is one of five kinds, discriminated by `kind`.

| Kind          | What it is                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------- |
| `table-field` | Bound to a column on the submit target; type, validation and persistence flow from the table |
| `standalone`  | Typed inline through `inputType`, and not written to a column directly                       |
| `calculation` | A read-only value computed from other fields; renders no input                               |
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

An attachment column renders a file input automatically.

## Standalone fields

Typed inline, and not written to a column. This is the kind for a form that routes to an automation or lives only in the ledger.

<!-- sovrium:options StandaloneFieldSchema -->

`inputType` is one of `short-text`, `long-text`, `email`, `url`, `phone`, `number`, `date`, `datetime`, `select`, `multi-select`, `checkbox`, `radio`, `rating` or `attachment`. `name` is unique within the form.

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

A value that already resolves — a default, or a prefill arriving from a query parameter — still wins outright and is never asked for twice. A free-text field is unaffected: an empty text box still stores an empty string.

## Calculation fields

<!-- sovrium:options CalculationFieldSchema -->

```yaml
fields:
  - { kind: standalone, name: quantity, inputType: number, label: Quantity }
  - { kind: standalone, name: unit_price, inputType: number, label: Unit price }
  - kind: calculation
    name: total
    label: Total
    formula: '{{quantity}} * {{unit_price}}'
    format: currency
```

The formula references other fields by name. The result is read-only and recomputes as its inputs change.

## Section and signature fields

<!-- sovrium:options SectionFieldSchema -->

<!-- sovrium:options SignatureFieldSchema -->

A section carries an optional heading and description plus a whole-section visibility rule, and renders no input of its own.

## Defaults and references

A field's `defaultValue` is a literal, or a reference resolved at render time — a URL query parameter, or a property of the signed-in user.

The top-level `prefill` map does the same job with the wiring kept in one block. The two differ in one way that matters: on a **public** form a per-field default referencing the signed-in user is refused when the configuration is decoded, naming the form and the field, while the prefill map tolerates the reference and drops it. Require authentication, or move the reference into `prefill`.

## Inline relationship create

When a form is embedded in a parent record's page — a "new ticket" button on a project page — a parent reference ties the new child back to its parent automatically. It is configured on the page's form control.

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

On submit the engine revalidates that the parent still exists, which is what defends against a stale reference in a page left open. Both single and multi-relationship columns are supported.
