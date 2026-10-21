# Structured Template Inputs

> A template that declares `inputs` can take lists and objects as well as text, and put a value in any field: its columns, its data source, its panels, its actions.

Plain variables fill text: a `$title` in `props`, `content` or `children`. That is enough for a badge or a card, and not for a template whose real variation is structural, such as a grid whose every placement reads a different table with different columns. Declaring `inputs` on the template gives each value a name and a kind, and lets the template name an input as the **whole value** of any field, at any depth. A `json` input takes any JSON value:

```yaml
components:
  - name: app-grid
    type: table
    rowActions: { display: menu }
    inputs:
      label: { kind: text, required: true }
      dataSource: { kind: json, required: true }
      columns: { kind: json, required: true }
      emptyMessage: { kind: text }
    props: { aria-label: $label }
    dataSource: $dataSource
    columns: $columns
    emptyMessage: $emptyMessage

pages:
  - name: invoices
    path: /invoices
    components:
      - component: app-grid
        vars:
          label: Invoices
          dataSource: { table: invoices }
          columns:
            - { field: number, label: Number }
            - { field: client, label: Client }
```

The template keeps the one decision every grid shares, here its row menu, in one place, and each placement passes the rest.

## The rules

| Rule               | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kinds              | `text`, `number`, `boolean` and `json` take a value; `slot` declares a named slot (see Reusable Components).                                                                                                                                                                                                                                                                                                                                                                                                          |
| Optional, left out | The field whose whole value names it is removed, so the component draws its own default. A list element that is only the input is dropped.                                                                                                                                                                                                                                                                                                                                                                            |
| Required, left out | Refused at startup, naming the page, the placement and the input.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Wrong shape        | Each placement is checked as the page component it produces; a value of the wrong shape is refused, naming the page, the placement and the input.                                                                                                                                                                                                                                                                                                                                                                     |
| Inside a string    | Only a `text`, `number` or `boolean` input may be written inside a longer string (`'grid-$id'`); a `json` one is refused, since a list has no text.                                                                                                                                                                                                                                                                                                                                                                   |
| Object keys        | Never substituted: a key that reads `$name` stays as written.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Tokens in a value  | A value is inserted as written and never substituted again. Its `$t:` keys and `$record` / `$query` tokens resolve as they would written inline.                                                                                                                                                                                                                                                                                                                                                                      |
| Reserved names     | The name of every binding root a page reads is refused as an input name, since each would hide a binding inside it: `record`, `parent`, `param`, `query`, `t`, `app`, `user`, `currentUser`, `session`, `window`, `vars`, `design`, `invitation`, `frontmatter`, `collection`, `form`, `response` and `env`; so are the relative-date tokens `today`, `now`, `startOfMonth` and `startOfNextMonth`, and the slot keywords `children` and `slots`. A placeholder word such as `label` names no binding and stays free. |
| A literal `$`      | `$$` writes a `$`, in a template that declares inputs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

Only the names a template declares follow these rules. Any other `$token` in it reads as it always has, and a template without `inputs` substitutes exactly as before.

## Tokens inside a value

Because a value is placed as if it were written at that spot, a translation key or a query token inside it is resolved by the page, with the page's own limits. Here `grid-header` is a template whose `header` is a `json` input it writes as `children: $header`; the `$query.period` inside the passed header still falls back to the page's declared default when the address carries a value the page does not declare:

```yaml
pages:
  - name: invoices
    path: /invoices
    query:
      period: { default: 7d, enum: [7d, 30d] }
    components:
      - component: grid-header
        vars:
          header:
            - { type: text, element: h1, content: '$t:invoices.title' }
            - { type: text, element: p, content: 'Period: $query.period' }
```

Values come only from the config file. Nothing a visitor sends can become an input value, rich text still passes through the same sanitising as when it is written inline, and a data source passed as a value is read under the same permissions.

## In a design tool

A value passed to a `text`, `number` or `boolean` input can be changed from a design tool and written back like any placement value. A value passed to a `json` input is template content: an edit to anything it draws is refused on import, naming the input, and the config keeps the value as written.
