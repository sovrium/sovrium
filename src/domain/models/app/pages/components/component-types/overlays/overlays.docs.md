# Overlay Components

> The seven types that float above the page — dialog, alert-dialog, drawer, popover, tooltip, hover-card and toast.

Overlay components float above the page. The three floating ones — popover, tooltip, hover-card — share `floatingSide` and `floatingAlign` positioning. The dialog family is opened by a **sibling** component whose `interactions.click.modal` names the overlay's `props.id`, and traps focus while open unless the dialog opts out of hydration. All accept the shared `props` bag plus the `visibility` and `responsive` modules.

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

<!-- sovrium:options type:dialog -->

`props.id` is the identifier the opener names; `props.title` and `props.description` are the heading and the supporting line; `children` are rendered inside the panel; and `formRef` names a top-level form from `app.forms[]` to render in the body.

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

`drawerSide` is the edge it slides from — `left`, `right`, `top`, `bottom` — and `drawerSize` a preset of `sm`, `md`, `lg` or `full`.

### The record-detail drawer

Give a drawer a `dataSource` and it becomes record-bound: it fetches one record, renders a control per field, and — unless you turn editing off — saves back through the record API. This is the panel a `table` opens on a row click, and it also self-opens on a `?record=<id>` deep link.

`dataSource` takes `{ table }` for a database record or `{ system }` to fetch one from a read endpoint; a system-bound drawer is read-only, because there is no table to save to. `recordFields` lists the fields to show, each `{ name, type }`, with `label` to rename an entry and `renderAs` to choose the rendering: `text`, the default, stringifies the value, and `json`, `list`, `key-value` and `code` each unpack a nested one. `canEdit: false` renders the record read-only. `actions` are footer buttons firing against the loaded record — `$record.*` resolves at click time, and `confirm` gates the click. `role` is `dialog` by default or `region`, and its accessible name comes from `props.title`. `id` is what a grid's `onRowClick: { action: openDrawer, component: <id> }` names.

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

The one supported position is a record-bound drawer's `children` — that is where a record has been fetched, so it is the only place an array carried by one exists. Five shapes are refused when the app boots, each because the failure would otherwise be silent:

| Refused                                                         | Why                                                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `repeat` beside `dataSource` on one container                   | Two row sources on one node, and nothing to choose between them.                                              |
| `repeat` outside a record-bound drawer's `children`             | No record, so nothing to iterate — the container would render its template exactly once.                      |
| `repeat` inside another `repeat`                                | `$record.<key>` would name a key on the inner element and on the outer one at once.                           |
| `visibility.record` on or under a `repeat`                      | The per-element gate runs on the server; a repeat expands in the browser, so the gate would apply to nothing. |
| `dataSource.system` carrying a `$record.` reference in the slot | Expanded server-side against the literal token, it resolves to nothing and fails closed to an empty region.   |

Linked rows are a different problem, and `repeat` does not solve it. An order's line items or a contact's activity are not _on_ the record — the records API nests values under `fields`, and links are ids — so they need a second read, on a page that knows the id from its own `path`.

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
