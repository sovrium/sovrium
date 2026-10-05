# Overlay Components

> The seven types that float above the page — dialog, alert-dialog, drawer, popover, tooltip, hover-card and toast.

Overlay components float above the page. The three floating ones — popover, tooltip, hover-card — share `floatingSide` and `floatingAlign` positioning. The dialog family is opened by a **sibling** component whose `interactions.click.modal` names the overlay's `props.id`, and traps focus while open unless the dialog opts out of hydration. All accept the shared `props` bag plus the `visibility` and `responsive` modules.

An overlay is gated with the triggers that open it. When every button, row click or action that opens a dialog, drawer or popover is hidden from a viewer — by `visibility` or a capability gate — the overlay is left out of that viewer's page too, not rendered and hidden. An overlay's own `visibility` still applies on top, so the two combine as AND.

```yaml
components:
  # The opener: any component whose click interaction names the dialog id
  - type: button
    props:
      id: confirm-btn
      label: Open
      interactions: { click: { modal: confirm-dialog } }
  - type: dialog
    props: { id: confirm-dialog, title: Confirm }
    children:
      - { type: text, content: 'Are you sure?' }
```

`progress` and `skeleton` are often reached for alongside these; both are feedback types and are documented there.

## `dialog`

A modal dialog. The dialog itself declares no trigger: it is opened by a sibling whose `props.interactions.click.modal` names this dialog's `props.id`. Clicking the backdrop or pressing Escape closes it, and focus is trapped within the panel while it is open.

Whether a dialog starts open depends on that opener. A dialog named by any `interactions.click.modal` in the page's configuration stays closed until it is opened — even when the trigger is not drawn yet, because it sits in a tab panel the reader has not opened or in another view of the page. A dialog nothing names opens on its own when the page loads.

<!-- sovrium:options type:dialog -->

`props.id` is the identifier the opener names; `props.title` and `props.description` are the heading and the supporting line, and both accept a `$t:` key that prints the active language's text — in the dialog's accessible name too; `children` are rendered inside the panel; and `formRef` names a top-level form from `app.forms[]` to render in the body.

A dialog has a close button in its header, named "Close" in the page language. A dialog that holds a form through `formRef` also offers a Cancel beside the form's submit, which closes the dialog without sending the form; both labels come from the page language, and an author renames them under `sovrium.dialog.close` and `sovrium.dialog.cancel`. A multi-step or one-question form keeps its own step buttons.

A dialog wrapping a form shows one title: its own, or the form's when it declares none.

**Write the heading and the supporting line inside `props`.** The option table above lists `title` and `description` because the schema declares them beside `type` as well, but only the `props` spelling reaches the panel today: a top-level `title` decodes cleanly and draws nothing. `hydrate` and `formRef` are the two keys this type reads from its own level.

### `hydrate: false` — the dialog without JavaScript

A dialog normally mounts a small interactive component, which is what contains focus inside the panel while it is open and returns focus to the trigger when it closes. `hydrate: false` skips that entirely: the page's built-in click handling opens and closes the overlay, and the page downloads nothing for it.

Everything else is the same — the same trigger, the same backdrop and Escape dismissal, the same close control, the same `children` and `formRef` in the body. What you give up is focus containment and focus restoration, so keep the default for anything holding a form, and reach for `hydrate: false` for read-only panels where the saving is worth more than the focus behaviour.

It is written out rather than guessed at, because nothing else in the config implies it: a dialog with no form and no children still contains focus today, so inferring the mode from what a dialog holds would silently take that away.

```yaml
- { type: button, content: Release notes, interactions: { click: { modal: notes } } }
- type: dialog
  hydrate: false
  props: { id: notes, title: Release notes, description: What changed in this version. }
  children:
    - { type: text, content: 'Formula fields now support dates.' }
```

**Migrating from `modal`.** The `modal` component type has been removed, and a config still naming it is refused at startup with a message pointing here. Rename the `type` to `dialog` and add `hydrate: false`; the trigger, the id and the dismissal behaviour are unchanged. Two things improve on the way across: a `dialog` renders its `children`, which a `modal` silently dropped, and it no longer announces itself to screen readers as blocking the rest of the page — a claim `modal` made without containing focus. Drop the `hydrate` line instead if you want the focus behaviour.

## `alert-dialog`

A confirmation dialog for a destructive action, with explicit confirm and cancel buttons.

<!-- sovrium:options type:alert-dialog -->

`content` is the message, `confirmLabel` and `cancelLabel` the two buttons, `trigger` the element that opens it, and `action` what running the confirm does — typically a `crud` delete.

## `drawer`

A panel that slides in from a screen edge.

<!-- sovrium:options type:drawer depth=3 -->

`drawerSide` is the edge it slides from — `left`, `right`, `top`, `bottom` — and `drawerSize` a preset of `sm`, `md`, `lg` or `full`. Its close button is named "Close" in the page language, like a dialog's, and is renamed under the same `sovrium.dialog.close`.

### The record-detail drawer

Give a drawer a `dataSource` and it becomes record-bound: it fetches one record, renders a control per field, and — unless you turn editing off — saves back through the record API. This is the panel a `table` opens on a row click, and it also self-opens on a `?record=<id>` deep link.

A drawer opened on a record it cannot show — one that does not exist, or one its reader may not read — says "This record could not be found." in the page language (`sovrium.recordDrawer.notFound` renames it) and offers nothing to edit or save; it says the same for both, so a reader cannot tell a hidden record from a missing one.

Opening a drawer on a record writes `?record=<id>&drawer=<drawer id>` into the address — whatever opened it: a grid row, a list item, a calendar event or another drawer's footer — so the link a reader copies reopens that drawer on that record, and only that drawer. Record ids are per table, so on a page declaring several record drawers a bare `?record=<id>` cannot say which one it means: it opens exactly one, the first record-bound drawer the page declares.

`dataSource` takes `{ table }` for a database record or `{ system }` to fetch one from a read endpoint; a system-bound drawer is read-only, because there is no table to save to. `recordFields` lists the fields to show, each `{ name, type }`, with `label` to rename an entry and `renderAs` to choose the rendering: `text`, the default, stringifies the value, and `json`, `list`, `key-value` and `code` each unpack a nested one. `canEdit: false` renders the record read-only; an attachment then reads as its file's name, linking to the file, as in the grid. An editable drawer draws each field with the control the form draws for it: a `status` or `single-select` is a choice of its options, a `user` a choice of accounts shown by name, and the drawer saves the stored value. A single-valued `relationship` is a picker searching the related table by its `displayField`: it shows the linked record by that field, and saving stores the picked record's key. An optional link also offers a Clear control, and saving then unlinks the record. The picker's candidates follow the related table's read permissions, so a record the reader may not read is neither offered nor named. A drawer shows each reader only what they may read: a field their role cannot read is left out, a field it cannot write is shown as its value without an editable control, and Save sends only the fields the reader may write. A drawer in which the reader may change none of the fields it shows — the table's `update` refuses her, or every field is read-only for her — draws no Save button at all. Save refuses a required field left blank, naming it in the page language; an optional field left empty saves. `actions` are footer buttons firing against the loaded record — `$record.*` resolves at click time, and `confirm` gates the click. A footer action may also be `{ action: openDrawer, component: <id> }`, which closes this drawer and opens the named one on the same record — a detail drawer whose Decide button opens the decision drawer. The drawer's `props.className` lands on the drawer surface the reader sees. `role` is `dialog` by default or `region`, and its accessible name comes from `props.title`, which accepts a `$t:` key like a dialog's. A drawer's title may name its record: `title: $record.name`, or `Role of $record.name`; it follows the record the drawer opens. `id` is what a grid's `onRowClick: { action: openDrawer, component: <id> }` names.

A read-only drawer lists its fields as a description list and draws each value as the grid does: a choice as a badge in its option colour, a user with an avatar, a date in the page's date format, a date-time as its date and time in the page language, at the field's own `timeZone`, else the operator time zone, a stored file by the name it was uploaded under, as a link to it, a checkbox as a check mark, a multi-select as chips, an amount in its currency. With no session, the drawer leaves out every field an anonymous reader may not read — no label, no empty value. An editable drawer draws each field with the control a form draws for its type, one input high: a date picker, a number input, a text area for long text, a checkbox, and a file picker for an attachment. A date-and-time field keeps a text box holding the stored instant.

```yaml
tables:
  - name: contacts
    fields:
      - { name: full_name, type: single-line-text }
      - { name: email, type: email }
pages:
  - name: Contacts
    path: /contacts
    components:
      - type: drawer
        id: contact-detail
        dataSource: { table: contacts }
        canEdit: true
        recordFields:
          - { name: full_name, type: single-line-text }
          - { name: email, type: email }
```

#### Composing content beside the record

`children` is the slot for content that belongs _about_ the record rather than _in_ it — a heading, a timeline of what happened to it, a line of commentary. It renders after the record's fields and before the footer `actions`, because the fields are the facts and the footer is where the reader acts on them. Omit it and the drawer renders exactly as it did before: no container, no separator, no spacer.

A `$record.<field>` written anywhere inside the slot resolves against the record the drawer opened for. The drawer opens before it knows which record that is, so the value appears once the record arrives — the same moment the fields fill in.

#### Repeating a child once per element of an array

A record often carries a list inside itself: the steps of a run, the lines of an order snapshot, the entries of a `json` column. `repeat` renders one copy of a container's children for each element of that list. It is declared on `container` and names one field of the bound record:

```yaml
- type: container
  element: section
  props: { aria-label: Steps }
  repeat: { record: steps }
  children:
    - { type: text, element: h3, content: '$record.index. $record.name' }
    - { type: text, content: 'Status: $record.status' }
```

The container itself renders once; its children render once per element. Inside a copy, `$record.<key>` names a key on **that element** rather than on the drawer's record — the same grammar, re-scoped. The drawer's own fields stay reachable everywhere outside the repeat.

`repeat` looks at what the drawer has already fetched; it never reads. An empty array, a missing field, or a field holding something that is not an array each render **zero copies** — never one unsubstituted template, which would ship `$record.` tokens to the browser as text and read as "this record has no steps". A key the element does not carry resolves to nothing, so a field that exists on the record but not on the element prints empty rather than leaking the record's value.

A key holding an **object or an array** is left as its literal `$record.<key>` token instead of being printed. `[object Object]` looks like data, and an empty string is indistinguishable from a null value; a surviving token can only mean "this binding did not resolve", and it names the key that did not.

#### Lists inside a list

A repeat may **name** its element with `as`. Inside a named repeat, `$<as>.<key>` reads the element and `$record.<key>` keeps reading the drawer's record, so nothing is hidden. A name is also what lets a second repeat sit inside the first: its `record` names a field of the **enclosing element**, the nearest record in scope.

```yaml
- type: container
  element: section
  props: { aria-label: Legs }
  repeat: { record: legs, as: leg }
  children:
    - { type: text, element: h2, content: '$leg.from → $leg.to' }
    - { type: text, content: 'Traveller: $record.traveller' }
    - type: container
      repeat: { record: stops, as: stop }
      children:
        - { type: text, element: h3, content: '$stop.city ($stop.minutes min)' }
        - { type: text, content: 'Leg from $leg.from' }
```

Each leg draws its own stops, the outer name stays readable inside the inner copies, and a leg whose `stops` list is empty draws none — the container is left with no content at all, so a `:empty` rule can style it. Without `as`, a repeat behaves exactly as described above. Two levels is the limit.

`repeat` has two supported positions: a record-bound drawer's `children`, where a record has been fetched, and a page bound to one record — a page-level `dataSource` of `{ system }` or `{ table, mode: 'single' }` — where the copies are drawn on the server and arrive in the first response. Those are the only places an array carried by a record exists. These shapes are refused when the app boots, each because the failure would otherwise be silent:

| Refused                                                                     | Why                                                                                                                  |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `repeat` beside `dataSource` on one container                               | Two row sources on one node, and nothing to choose between them.                                                     |
| `repeat` outside a record-bound drawer's `children` and a record-bound page | No record, so nothing to iterate — the container would render its template exactly once.                             |
| `repeat` inside a `dataSource` row template on a bound page                 | There `$record.` is the row, not the page's record, so the array is a different one on every row.                    |
| `repeat.as` naming `record`, `param`, `query` or another built-in namespace | The token would mean two things. A name must also be a plain identifier: `my-leg` cannot be spelled as one.          |
| `repeat` inside a `repeat` that has no `as`                                 | `$record.<key>` would name a key on the inner element and on the outer one at once.                                  |
| `repeat.as` an enclosing repeat already uses                                | The inner element would silently hide the outer one.                                                                 |
| `$<as>.<key>` outside the repeat that declares `as`                         | Nothing resolves it there, so it would ship as literal text.                                                         |
| repeats nested deeper than two                                              | Each level multiplies the copies; two is the same bound the row templates carry.                                     |
| `visibility.record` on or under a `repeat`                                  | The per-element gate runs only for row templates; a repeat's copies never evaluate it, so it would apply to nothing. |
| `dataSource.system` carrying a `$record.` reference in the slot             | Expanded server-side against the literal token, it resolves to nothing and fails closed to an empty region.          |

Linked rows are a different problem, and `repeat` does not solve it. An order's line items or a contact's activity are not _on_ the record — the records API nests values under `fields`, and links are ids — so they need a second read, which is what `related` declares.

#### Related records

A record usually has records of its own in other tables: a company's contacts, a project's tasks, an asset's loans. They are not stored on the record — each points back to it through a relationship column — so the drawer reads them separately. `related` declares those reads. Each entry becomes its own section below the record's fields, headed by its `label`, listing the rows of `table` whose `field` points at the record the drawer opened.

```yaml
- type: drawer
  id: company-detail
  dataSource: { table: companies }
  related:
    - label: Contacts
      table: contacts
      field: company # the relationship column on contacts that points at companies
      columns:
        - { field: name, label: Name }
        - { field: role, label: Role }
      sort: [{ field: name, direction: asc }]
      limit: 10
      emptyMessage: No contact for this company yet.
      onRowClick: { action: openDrawer, component: contact-detail }
```

A related section prints labels and money as the grid does: a relationship column shows the related record's `displayField`, a `user` column the account's name, and a `currency` column the amount in the field's own currency. The list is read when the drawer opens, and again each time it opens on another record. It is read-only and compact: no toolbar, no inline editing. It follows the related table's own permissions. A `columns` entry on a field of `table` its reader may not read is left out, and the page does not name it. A reader who may not read `table` sees no section at all, and the create button appears only for a reader allowed to create in `table`. A click on a row does nothing unless `onRowClick` says so: `openDrawer` opens that row in another drawer on the page, bound to `table`, in place of this one; `navigate` follows a path, with `$record.*` taken from the clicked row.

`field` must be a `relationship` column of `table` whose `relatedTable` is the drawer's own table. Sovrium refuses to start otherwise, naming the entry (`related[0].field`), the column and the table. The same goes for a `table` that does not exist, a `columns` or `sort` field `table` does not have, an `openDrawer` target that is not a drawer on the page bound to `table`, and `related` on a drawer that is not bound to a table. Related lists go one level deep: a related row's own related records are reached by opening it.

**Migrating from `record-drawer`:** rename the `type` to `drawer` and change nothing else. `dataSource`, `recordFields`, `canEdit`, `actions`, `role` and `id` all carry over unchanged, and a drawer additionally accepts `drawerSide` and `drawerSize`. The `dataSource` is what makes it record-bound, so the renamed drawer still answers the same `openDrawer` row-click.

## `popover`

A floating panel anchored to a trigger, opened on click.

<!-- sovrium:options type:popover -->

`floatingSide` is the preferred side relative to the trigger — `top`, `right`, `bottom`, `left` — and `floatingAlign` the alignment along it: `start`, `center`, `end`.

## `tooltip`

A small hover hint anchored to a trigger.

<!-- sovrium:options type:tooltip -->

## `hover-card`

A richer popover that opens on hover, for a profile preview or a link peek.

<!-- sovrium:options type:hover-card -->

`openDelay` and `closeDelay` are milliseconds before it opens on hover and before it closes after the pointer leaves.

## `toast`

A transient notification. Toasts are usually emitted from an action's `onSuccess` or `onError` handler rather than placed in the tree directly; page-level placement is configured on the page itself.

`toast` declares no schema option of its own — its fields ride in the open `props` bag. `variant` is `success`, `error`, `warning`, `info`, `default` or `destructive`; `message` is the text and substitutes `$variable` references; `duration` is the auto-dismiss time in milliseconds, defaulting to 5000; `actionLabel` and `actionUrl` add an action button.

Two kinds are left off the timer: one whose `variant` is `error` or `destructive`, and one that renders an action button (`actionLabel` together with `actionUrl`). A failure nobody read is a failure that did not happen, and an action that expires before it is reached is not an action.

Neither one is stranded either. A toast that is not on a timer carries a close button, and `Escape` clears the most recent one, so a reader who is done with it never has to leave it holding the corner of the screen. Each kind still ends its own way as well: an action toast goes when its button is used, and any toast goes when the page changes. A toast that does expire on its own carries no close button.

An `error` or `destructive` toast is also announced urgently to assistive technology, interrupting whatever is being read; every other toast waits its turn. An explicit `duration` overrides all of this, an error included. Multiple toasts stack without overlapping.
