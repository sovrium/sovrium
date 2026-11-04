# Button Fields

> A column that is a control rather than a value: it opens a URL or runs an automation, and can be shown on some records only.

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

Every other field type inherits a `label` from the base: the human-readable name a column header or a form row shows in place of the raw `name`. A `button` does not, and the table above is one row shorter than its siblings for that reason: the type spends the top-level `label` key on the **text printed inside the button**, and a struct cannot declare the same key twice.

So `label: Approve` puts the word _Approve_ on the control. It is required, because a button with no text is a button nobody presses. A button field has no separate display name; where a surface needs one, name the column at the surface (`columns[].label` on a table, `recordFields[].label` on a record view), which wins over the field-level `label` for every other type anyway.

## `action` is a closed two-value vocabulary

`action: url` demands `url`; `action: automation` demands `automation`. Any other value, including an empty string, is refused at startup.

### A url that names its record

A `url` may name fields of the record the button is drawn on as `$record.<field>`: `url: /cases/$record.id?ref=$record.reference`. Each token reads that record wherever the button is drawn: a grid, a record page, a drawer or an edit form. A value placed inside the address is URL-encoded, so `Dossier Martin & fils` arrives as `Dossier%20Martin%20%26%20fils`; a token that is the whole `url` (`url: $record.portal`) is the address itself, so a `url` field can hold the destination. A field the reader may not read resolves to nothing, and neither its value nor its name reaches the page: a record page receives the finished address, and a grid, drawer or form receives the `url` with that token already taken out. On a grid bound to a view, a field the view does not serve counts as one the reader may not read. A `url` that names only fields the reader may not read leaves her nowhere to go, so the button is not drawn for her. The address is then opened only when it is a path on the same site or an `http(s)` URL; anything else, such as `javascript:`, opens nothing.

Keep tokens in the path or the query. A token in the host (`https://$record.host/…`) lets whoever can write that field choose where the button sends every reader. A token written with a backslash, `\$record.reference`, is printed as written rather than read from the record.

That strictness is not tidiness. `action` is the dispatch key both the renderer and the invoke endpoint switch on, so a value neither of them recognises would render a button that silently does nothing when pressed. Refusing the configuration is the only outcome that tells anybody.

The automation a button names must carry a `manual` trigger to be invocable this way. An automation triggered only by a record event cannot be started by a person.

A press waits for its run and answers `200` with the run's id and how it ended, and the person sees whether the action completed. A run can take longer than that: it may wait its turn behind other runs of an automation with a `concurrency` limit, or its steps may simply be slow. When the run has not ended about two seconds before the server's idle guard (`SOVRIUM_REQUEST_IDLE_TIMEOUT_S`, 10 seconds by default, so after 8 seconds), the press answers `202` with `{ runId, status }`, where `status` is `queued` or `running`, and the person reads _The action is under way._ instead of a failure. The run goes on and completes; its outcome is in the run history under that `runId`. Widening the guard widens this wait with it.

## Showing a button on some records only

`visibleWhen` names a record field and applies the shared condition vocabulary (`eq`, `neq`, `in`, `notIn`, `contains`, `gt`, `lt`, `gte`, `lte`, and the presence flags `isEmpty: true` / `isNotEmpty: true`) to its value. Supplying several operators requires all of them to hold. A presence flag treats a missing value, an empty text, an empty list and an empty object alike, so `{ field: phone, isNotEmpty: true }` shows the button only on records that actually have a phone number.

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

## Disabling a button on some records

`disabledWhen`, in the same grammar, keeps the button on the record but disabled, and `disabledReason` says why: `{ disabledWhen: { field: credit_balance, lt: 8 }, disabledReason: You need at least 8 credits. }`. The button is marked `aria-disabled`, stays focusable, and pressing it starts nothing; the reason shows in a tooltip on hover and on focus and is its accessible description. The condition is checked by the server on the whole record, even a field the reader may not read; the page receives only that the button is disabled (`_disabled: ['field:<name>']` on the record). A press sent to the invoke endpoint answers, in order: 404 for the dispatch, write and role checks as before; 404 when `visibleWhen` does not hold; 409 `ACTION_DISABLED` with the reason when `disabledWhen` holds.

## Visibility is not permission

`visibleWhen` decides what is drawn. It does not decide what may run: the automation behind the button is subject to the same permissions it would be subject to anywhere else, and a caller who reaches the invoke endpoint directly is checked there. Use `visibleWhen` to keep an irrelevant control off a record, and the automation's own gating to keep an unauthorised caller out of it.
