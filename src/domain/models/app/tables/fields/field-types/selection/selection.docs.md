# Selection Fields

> The four selection field types — checkbox, single-select, multi-select and status.

Four field types let records choose from predefined options. All of them also accept the base field properties every field type shares.

| Type            | Stores                                          |
| --------------- | ----------------------------------------------- |
| `checkbox`      | A boolean true/false value.                     |
| `single-select` | One option chosen from a predefined list.       |
| `multi-select`  | Multiple options chosen from a predefined list. |
| `status`        | One option, named as a workflow state.          |

## Option grammar

`single-select`, `multi-select` and `status` share one grammar for `options`. Every option is **either a bare string, or an object** — and the two forms mix freely in the same list.

| Form                        | Use it when                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `Draft`                     | The stored value is also the display label, and needs no colour.                   |
| `{ value, label?, color? }` | The option needs a display label, a translation key, a colour, or any combination. |

| Key     | Description                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `value` | Required. The value stored in the database and enforced by the column constraint. Values must be unique across the option list. |
| `label` | Optional display text. May be a `$t:` translation key. Defaults to `value`.                                                     |
| `color` | Optional hex code `#RRGGBB` painted as the option's chip fill.                                                                  |

```yaml
options:
  - Draft # bare string
  - { value: review, label: In review }
  - { value: published, label: '$t:statusPublished', color: '#10B981' }
```

Changing an option's `label` or `color` never rewrites stored data — only `value` is persisted. That is what makes renaming a label safe and renaming a `value` a migration.

## `checkbox`

A boolean. Stored as a real boolean column, so it filters and aggregates as one rather than as the strings `"true"` and `"false"`.

<!-- sovrium:options CheckboxFieldSchema -->

```yaml
- { id: 1, name: is_active, type: checkbox, default: true }
```

## `single-select`

One option from the list, enforced by a column constraint rather than only by the UI — so a value written through the API is refused just as a value chosen in a form would be.

<!-- sovrium:options SingleSelectFieldSchema -->

```yaml
- id: 2
  name: priority
  type: single-select
  options:
    - { value: low, color: '#94a3b8' }
    - { value: high, color: '#ef4444' }
```

## `multi-select`

Several options from the list.

<!-- sovrium:options MultiSelectFieldSchema -->

```yaml
- id: 3
  name: tags
  type: multi-select
  options: [design, engineering, sales]
```

## `status`

One option, named as a workflow state. Structurally a `single-select`; the distinct type is what lets a board group by it and a view colour a row from it without guessing which of several selects is the workflow.

<!-- sovrium:options StatusFieldSchema -->

```yaml
- id: 4
  name: stage
  type: status
  options:
    - { value: todo, label: To do }
    - { value: doing, label: In progress, color: '#f59e0b' }
    - { value: done, label: Done, color: '#10b981' }
```
