# Button Fields

> A column that is a control rather than a value — it opens a URL or runs an automation, and can be shown on some records only.

A `button` field renders an interactive control on a record. It stores nothing.

<!-- sovrium:options ButtonFieldSchema -->

```yaml
- {
    id: 4,
    name: approve,
    type: button,
    label: Approve,
    action: automation,
    automation: approve_request,
  }
```

## `label` is the button's text, not the field's display name

Every other field type inherits a `label` from the base — the human-readable name a column header or a form row shows in place of the raw `name`. A `button` does not, and the table above is one row shorter than its siblings for that reason: the type spends the top-level `label` key on the **text printed inside the button**, and a struct cannot declare the same key twice.

So `label: Approve` puts the word _Approve_ on the control. It is required, because a button with no text is a button nobody presses. A button field has no separate display name; where a surface needs one, name the column at the surface — `columns[].label` on a table, `recordFields[].label` on a record view — which wins over the field-level `label` for every other type anyway.

## `action` is a closed two-value vocabulary

`action: url` demands `url`; `action: automation` demands `automation`. Any other value — including an empty string — is refused at startup.

That strictness is not tidiness. `action` is the dispatch key both the renderer and the invoke endpoint switch on, so a value neither of them recognises would render a button that silently does nothing when pressed. Refusing the configuration is the only outcome that tells anybody.

The automation a button names must carry a `manual` trigger to be invocable this way. An automation triggered only by a record event cannot be started by a person.

## Showing a button on some records only

`visibleWhen` names a record field and applies the shared condition vocabulary — `eq`, `neq`, `in`, `notIn`, `contains`, `gt`, `lt`, `gte`, `lte` — to its value. Supplying several operators requires all of them to hold.

```yaml
- {
    id: 5,
    name: ship,
    type: button,
    label: Ship,
    action: automation,
    automation: ship_order,
    visibleWhen: { field: status, eq: pending },
  }
```

This is the same grammar a data table's row actions use, so "show this control on some records" reads the same wherever it is written.

Omitting `visibleWhen` shows the button on every record.

## Visibility is not permission

`visibleWhen` decides what is drawn. It does not decide what may run: the automation behind the button is subject to the same permissions it would be subject to anywhere else, and a caller who reaches the invoke endpoint directly is checked there. Use `visibleWhen` to keep an irrelevant control off a record, and the automation's own gating to keep an unauthorised caller out of it.
