# Overlay Components

> The seven types that float above the page — dialog, alert-dialog, sheet, popover, tooltip, hover-card and toast.

Overlay components float above the page. The three floating ones — popover, tooltip, hover-card — share `floatingSide` and `floatingAlign` positioning. The dialog family is opened by a **sibling** component whose `interactions.click.modal` names the overlay's `props.id`, and traps focus while open unless the dialog opts out of hydration. All accept the shared `props` bag plus the `visibility` and `responsive` modules. The panels follow shadcn/ui's anatomy. A dialog, an alert dialog, a sheet, a popover and a hover card paint the `popover` colour as their surface — `design.colors.popover` recolours them — and draw a faint ring around their edge rather than a border. `design.colors.border` reaches the dividers they still draw: the band at the foot of an alert dialog that holds its buttons, and the inner edge of a sheet. A tooltip is the inverse: a small chip in the `foreground` colour. The backdrop behind a dialog or a sheet is a light tint that blurs the page where the browser supports it.

An overlay is gated with the triggers that open it. When every button, row click or action that opens a dialog, sheet or popover is hidden from a viewer — by `visibility` or a capability gate — the overlay is left out of that viewer's page too, not rendered and hidden. An overlay's own `visibility` still applies on top, so the two combine as AND.

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

A dialog, an alert dialog, a sheet, a record-detail sheet and a popover can each be closed by an action inside it: a button, a form, a file upload or a record-detail sheet's footer action whose `onSuccess` sets `close: true` closes the overlay it sits in once its request succeeds, after its toast. When two are nested, only the innermost closes. A failed request closes nothing. See [Once the action has answered](/en/docs/interactive-components#once-the-action-has-answered). `progress` and `skeleton` are often reached for alongside these; both are feedback types and are documented there.

## `dialog`

A modal dialog. Reference: shadcn/ui Dialog. The dialog itself declares no trigger: it is opened by a sibling whose `props.interactions.click.modal` names this dialog's `props.id`. Clicking the backdrop or pressing Escape closes it, and focus is trapped within the panel while it is open. Whether a dialog starts open depends on that opener. A dialog named by any `interactions.click.modal` in the page's configuration stays closed until it is opened — even when the trigger is not drawn, because it sits in a tab panel the reader has not opened, in another view of the page, or behind a `visibility` rule that hides it on this record. A dialog is closed whenever its trigger is absent, whatever the reason. A dialog nothing names opens on its own when the page loads. A dropdown menu item, which carries an `action` and no `props`, opens one with `action: { action: openDialog, component: <the dialog's props.id> }`, the twin of `openSheet` for a sheet, and a button takes the same action: the dialog counts as having an opener, so it stays closed until then, and Escape gives the focus back to the menu's trigger. `component` must name a `dialog` declared on the same page; an id no dialog carries is refused when the config loads.

<!-- sovrium:options type:dialog -->

`props.id` is the identifier the opener names; `props.title` and `props.description` are the heading and the supporting line, and both accept a `$t:` key that prints the active language's text — in the dialog's accessible name too; `children` are rendered inside the panel; and `formRef` names a top-level form from `app.forms[]` to render in the body.

A dialog is modal: while it is open, Tab and Shift+Tab move only between its own controls, the page behind it is out of reach of assistive technology, and Escape closes it and gives the focus back to what opened it. A dialog has a close button in its top corner — an X icon, named "Close" in the page language. A dialog that holds a form through `formRef` also offers a Cancel beside the form's submit, which closes the dialog without sending the form; both labels come from the page language, and an author renames them under `sovrium.dialog.close` and `sovrium.dialog.cancel`. A multi-step or one-question form keeps its own step buttons. A dialog wrapping a form shows one title: its own, or the form's when it declares none. A dialog waits for the work it holds. While a form inside it is sending, or a button inside it is running its action, Escape and a click on the backdrop do not close it, and its close button and Cancel are disabled, so the reader sees how the request ended — and, for a form, any field the server refused. A close the action itself asks for once it succeeds still closes it. The same holds for a `sheet`, a record-detail sheet and a `popover`, whose click outside also waits.

**The heading and the supporting line** may be written beside `type` (`title`, `description`) or inside `props`; when both are written, the `props` spelling wins. `footer` holds components drawn in the band at the foot of the panel, under the body — the dialog's own Cancel and Save, say. `showCloseButton: false` draws no corner close button, leaving Escape, the backdrop and the footer's buttons to close it. `hydrate` and `formRef` are the other keys this type reads from its own level.

### `hydrate: false` — the dialog without JavaScript

A dialog normally mounts a small interactive component, which is what contains focus inside the panel while it is open and returns focus to the trigger when it closes. `hydrate: false` skips that entirely: the page's built-in click handling opens and closes the overlay, and the page downloads nothing for it.

Everything else is the same — the same trigger, the same backdrop and Escape dismissal, the same close control, the same `children` and `formRef` in the body. What you give up is focus containment and focus restoration, so keep the default for anything holding a form, and reach for `hydrate: false` for read-only panels where the saving is worth more than the focus behaviour. It is written out rather than guessed at, because nothing else in the config implies it: a dialog with no form and no children still contains focus today, so inferring the mode from what a dialog holds would silently take that away.

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

A confirmation dialog for a destructive action, with explicit confirm and cancel buttons. Reference: shadcn/ui Alert Dialog. The two buttons sit in a band at its foot, and a `destructive` variant shows its intent on the confirm button alone. Escape closes it like Cancel; a click outside it does not.

<!-- sovrium:options type:alert-dialog -->

`content` is the message, `confirmLabel` and `cancelLabel` the two buttons — left out, they read Continue and Cancel in the page language — `trigger` the element that opens it, and `action` what running the confirm does — typically a `crud` delete. `size: sm` draws a narrower confirmation whose icon, title and two buttons stack and centre. `icon` names a Lucide icon drawn in a tile with the title — above it at `size: sm` and on a narrow screen, beside it at the default size on a wide one; it is decorative and hidden from assistive technology.

`confirmText` asks for a typed confirmation: the dialog draws a field, and the confirm button stays disabled until the reader has typed exactly that text. Use it for what cannot be undone — deleting an account or everything in a workspace — and make it something the reader knows, such as `$session.email` or `$record.name`, rather than a fixed word.

## `sheet`

A panel that slides in from a screen edge. Reference: shadcn/ui Sheet. It was named `drawer` until shadcn/ui's name was adopted; `drawer` is now the panel rising from the bottom edge, and a side panel's keys written on a `drawer` are refused with a message naming `sheet`.

<!-- sovrium:options type:sheet depth=3 -->

`drawerSide` is the edge it slides from — `left`, `right`, `top`, `bottom` — and `drawerSize` a preset of `sm`, `md`, `lg` or `full`. Its close button is the same X icon as a dialog's, named "Close" in the page language and renamed under the same `sovrium.dialog.close`. `title` and `description` name and describe it, `footer` draws its actions at the foot of the panel below the body, and `showCloseButton: false` draws no close button, leaving Escape and the overlay to close it. A button whose `action` is `{ action: openSheet, component: <id> }` opens it, as a click interaction naming its id does.

### The record-detail sheet

Give a sheet a `dataSource` and it becomes record-bound: it fetches one record, renders a control per field, and — unless you turn editing off — saves back through the record API. This is the panel a `table` opens on a row click, and it also self-opens on a `?record=<id>` deep link. A table-bound sheet that declares neither `recordFields` nor `related` derives everything from its table. Its fields are one list, in the order the table declares them, under tabs: Details, then Activity — the record's changes, newest first, read when the tab opens — for a signed-in reader, Comments when the table declares `comments`, and Access — the accounts granted the record, by name, address and role, read-only — on a table listed in `auth.scopeTables`, for an admin; `&tab=<tab>` in the address opens it on that tab. Under the fields, "Linked from" lists, for each other table whose relationship points at the record, how many of its records do and the first five, each opening in the same sheet with a Back control. Its header offers Copy link and a More actions menu with Export as CSV and, for a reader the table lets delete, Delete, asked first; its footer says when and by whom the record last changed, beside Cancel and Save for a reader who may change the record — a reader whose role the table's `update` rule refuses, the operator console's read-only tier included, gets the sheet read-only on every tab. Opened with no record — by a page button whose action is `{ action: openSheet, component: <id> }`, or the address `?record=new` — it creates one: "New <table label>", or "New record" for a table that declares no `label`, every field the reader writes empty or at its `default`, required ones marked `*`, and Save creates the record — a `default` the server resolves, such as `$currentUser` or `$now`, leaves its control empty, and a field left untouched is left out of the create, so the server fills it; a refused value is marked under its field, and any other failure says "Couldn’t save the record. Try again." with the sheet still open. An edit the records API refuses as not found or forbidden — the record is gone, or the reader may no longer change it — says "You can’t change this record, or it no longer exists." and keeps the sheet open. Every word it draws is in the page language.

A sheet opened on a record it cannot show — one that does not exist, or one its reader may not read — says "This record could not be found." in the page language (`sovrium.recordDrawer.notFound` renames it) and offers nothing to edit or save; it says the same for both, so a reader cannot tell a hidden record from a missing one. A sheet whose record read fails — the connection drops, or a proxy answers an error — asks once more on its own; when that fails too it says "This record couldn’t be read." with a Retry button (`sovrium.recordDrawer.readFailed` and `sovrium.recordDrawer.retry` rename them), and draws no field and no Save until the record is in, so a Save can never write blanks over the stored values. A sheet bound to a system detail endpoint whose read is refused or fails says the same, without Retry: a refused read is not asked again. A date or date-time the record does not carry reads —.

Opening a sheet on a record writes `?record=<id>&drawer=<sheet id>` into the address — whatever opened it: a grid row, a list item, a calendar event or another sheet's footer — so the link a reader copies reopens that sheet on that record, and only that sheet. Record ids are per table, so on a page declaring several record sheets a bare `?record=<id>` cannot say which one it means: it opens exactly one, the first record-bound sheet the page declares.

`dataSource` takes `{ table }` for a database record or `{ system }` to fetch one from a read endpoint; a system-bound drawer is read-only, because there is no table to save to. A system source can follow a channel as a grid's does: `bindTo` names it and `sharedFilter.params` the params it takes, which are added to the detail read beside `query`, the record being read again when they change — `{ bindTo: submissions-filter, sharedFilter: { params: [reveal] } }` makes a submission sheet read its answers while the inbox's Reveal answers switch is on, and leaves the inbox's search text out of the read. `recordFields` lists the fields to show, each `{ name, type }`, with `label` to rename an entry and `renderAs` to choose the rendering: `text`, the default, stringifies the value, and `json`, `list`, `key-value` and `code` each unpack a nested one. `key-value` lists each key as a term over its value, and a key whose value is itself an object as a titled group of that object's pairs, named by the key, after the plain pairs — a form's section and the answers under it. `valueLabels` renames stored values in a read-only entry as it does in a grid column — `{ done: processed }` prints "processed" where the record holds `done` — and a value it leaves out prints as stored; on an option field the renamed value keeps its chip and colour, and a value the map leaves out reads as its option's label. An editable control, a save and the API keep the stored value. `canEdit: false` renders the record read-only; an attachment then reads as its file's name, linking to the file, as in the grid. An editable drawer draws each field with the control the form draws for it: a `status` or `single-select` is the app's Select of its options, and a `user` the Select of the accounts shown by name — one input high, opening its list below the field, Escape closing the list and not the drawer. A stored value no option lists is still shown, and the drawer saves the stored value. A single-valued `relationship` is a picker searching the related table by its `displayField`: it shows the linked record by that field, and saving stores the picked record's key. An optional link also offers a Clear control, and saving then unlinks the record. The picker's candidates follow the related table's read permissions, so a record the reader may not read is neither offered nor named. A drawer shows each reader only what they may read: a field their role cannot read is left out, a field it cannot write is shown as its value without an editable control, and Save sends only the fields the reader may write. A drawer in which the reader may change none of the fields it shows — the table's `update` refuses her, or every field is read-only for her — draws no Save button at all. On a record it opened, Save stays off until a value differs from what the record holds, and turns off again when the value is put back; a new record offers Save from the start. Save refuses a required field left blank, naming it in the page language; an optional field left empty saves. `actions` are footer buttons firing against the loaded record — `$record.*` resolves at click time, `confirm` gates the click, and `variant` draws the button as a `button` of that variant draws it — an outline button when it names none. A footer action may also be `{ action: openSheet, component: <id> }`, which closes this sheet and opens the named one on the same record — a detail sheet whose Decide button opens the decision sheet. A footer `crud` action runs against the loaded record once its question is answered: `delete` removes the record, closes the sheet and takes its row out of the grid behind it, and `update` writes the action's `data` onto it, the grid showing the new values. `operation: create` is refused when the config is read, because a footer has no form to fill and acts on a record that already exists; put a form in a dialog instead. The Cancel of a footer question is in the page language. A footer action with `declares` is drawn only when the app declares that capability, asked about the sheet's own table: `declares: auth.scopeTables` offers a "Who has access" button on the records of a table listed in `auth.scopeTables` and on no other, from one sheet written for every table. An unmet clause removes the button from the page rather than drawing it disabled. A `recordFields` entry or a footer action with `visibleWhen` is drawn only on a record that meets it — the condition a grid's row actions take, `{ field, eq | neq | in | notIn | contains | gt | lt | gte | lte | isEmpty | isNotEmpty }`, read against the open record: `visibleWhen: { field: status, eq: Rejected }` shows a rejection reason on a rejected claim only, and `{ field: status, eq: Pending }` on Approve keeps the button off a claim already decided. The condition reads the record the sheet loaded, not the values being typed into it; when a footer action changes that record while the sheet stays open, the sheet reads it again and its fields and buttons follow. An unmet condition leaves the entry or the button out, never drawn disabled. Hiding is not a permission: a hidden field keeps its value when the sheet is saved, and a reader allowed to read it still finds it in the records API. A `visibleWhen.field` the sheet's table does not have is refused when the config is read. The sheet's `props.className` lands on the sheet surface the reader sees. `role` is `dialog` by default or `region`, and its accessible name comes from `props.title`, which accepts a `$t:` key like a dialog's; a table-bound sheet with no `title` is named by its record — its first single-line text, email, phone number or address field holding a value, else its id — and the page served for its `?record=` address already carries that name. A sheet's title may name its record: `title: $record.name`, or `Role of $record.name`; it follows the record the sheet opens. `id` is what a grid's `onRowClick: { action: openSheet, component: <id> }` names.

A read-only drawer lists its fields as a description list and draws each value as the grid does: a choice as a badge in its option colour, under its option's label, a user with an avatar, a date in the page's date format, a date-time as its date and time in the page language, at the field's own `timeZone`, else the operator time zone, a stored file by the name it was uploaded under, as a link to it, a checkbox as a check mark, a multi-select as chips, an amount in its currency. The drawer draws exactly the fields the records API returns to its reader, and with no session those an anonymous reader may read: a field withheld from her — by a field rule, or because it is a count, a rollup, a lookup or a link to many records over a table she may not read — has no row, no label and no empty value, while a field she may read whose value is empty reads "—". An editable drawer draws each field with the control a form draws for its type, one input high: a number input, a text area for long text, and a checkbox. A date is the date picker a form draws: a box in the page's own date format (`14/10/2026` on an English (UK) page, whatever the browser's language), showing that format as its placeholder (`MM/DD/YYYY` on an English (US) page), typed back the same way, with a "Pick a date" calendar inside its end, and saved as that calendar day. A link holding one record is a picker showing the linked record's name, with a button that lists the linked table's records without typing. A currency field is a text box flanked by its currency's sign, its amount grouped as the page reads numbers (`12,480` on an English page) and typed back the same way, saved as a plain number. An attachment is a drop zone saying "Drop files or browse" and what its bucket takes in words (`PDF, images · 20 MB each`); a file dropped on it, or chosen through "browse", uploads to the bucket and is stored on the record when the sheet saves. A date-and-time field is a date-and-time input showing the time in the field's `timeZone`; a rating is its rating scale, a multi-select one checkbox per option, rich text and code their editors, a colour a colour picker, a duration `h:mm` (saved as seconds), JSON a text area that refuses text that does not parse before anything is sent, and a link holding several records chips of the linked records beside a picker. A formula, rollup, lookup, count or autonumber field, an AI field (marked "AI") and the created and updated stamps are read-only values: no control, and Save never sends them.

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
      - type: sheet
        id: contact-detail
        dataSource: { table: contacts }
        canEdit: true
        recordFields:
          - { name: full_name, type: single-line-text }
          - { name: email, type: email }
```

#### Composing content beside the record

`children` is the slot for content that belongs _about_ the record rather than _in_ it — a heading, a timeline of what happened to it, a line of commentary. It renders after the record's fields and before the footer `actions`, because the fields are the facts and the footer is where the reader acts on them. Omit it and the drawer renders exactly as it did before: no container, no separator, no spacer. A `$record.<field>` written anywhere inside the slot resolves against the record the drawer opened for. The drawer opens before it knows which record that is, so the value appears once the record arrives — the same moment the fields fill in.

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

`repeat` looks at what the drawer has already fetched; it never reads. An empty array, a missing field, or a field holding something that is not an array each render **zero copies** — never one unsubstituted template, which would ship `$record.` tokens to the browser as text and read as "this record has no steps". A key the element does not carry resolves to nothing, so a field that exists on the record but not on the element prints empty rather than leaking the record's value. A key holding an **object or an array** is left as its literal `$record.<key>` token instead of being printed. `[object Object]` looks like data, and an empty string is indistinguishable from a null value; a surviving token can only mean "this binding did not resolve", and it names the key that did not.

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

Each leg draws its own stops, the outer name stays readable inside the inner copies, and a leg whose `stops` list is empty draws none — the container is left with no content at all, so a `:empty` rule can style it. Without `as`, a repeat behaves exactly as described above. Two levels is the limit. **Where a copy resolves its tokens.** Inside a drawer, a copy resolves them in its text, its string children and its `data-*` attributes. On a page bound to one record, where the server expands the repeat before the page is sent, a copy also resolves them in its `title`, `description` and `label`, and in its `href`, `src` and `alt`, whether those are written as props or at the component's root, so an `item` per step can read `title: $step.name`. A value is always inserted as text: markup in a value prints as written and never becomes elements.

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
- type: sheet
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
      onRowClick: { action: openSheet, component: contact-detail }
```

A related section prints labels and money as the grid does: a relationship column shows the related record's `displayField`, a `user` column the account's name, and a `currency` column the amount in the field's own currency. The list is read when the drawer opens, and again each time it opens on another record. It is read-only and compact: no toolbar, no inline editing. It follows the related table's own permissions. A `columns` entry on a field of `table` its reader may not read is left out, and the page does not name it. A reader who may not read `table` sees no section at all, and the create button appears only for a reader allowed to create in `table`. Its form draws each column the reader may write with the control an editable drawer draws for that type — a date as the date picker, in the page's own format, a `status` or `single-select` as the Select of its options, a number as a number input, a `user` or a link as its picker — and stores each value as its column holds it, linked to the opened record. A computed column gets no control. A value the server refuses on one field, such as a value a `unique` field already holds, is marked on that field with the reason, and the form stays open with what was typed. A click on a row does nothing unless `onRowClick` says so: `openSheet` opens that row in another sheet on the page, bound to `table`, in place of this one; `navigate` follows a path, with `$record.*` taken from the clicked row.

`field` must be a `relationship` column of `table` whose `relatedTable` is the drawer's own table. Sovrium refuses to start otherwise, naming the entry (`related[0].field`), the column and the table. The same goes for a `table` that does not exist, a `columns` or `sort` field `table` does not have, an `openSheet` target that is not a sheet on the page bound to `table`, and `related` on a sheet that is not bound to a table. Related lists go one level deep: a related row's own related records are reached by opening it.

**Migrating from `record-drawer`:** rename the `type` to `sheet` and change nothing else. `dataSource`, `recordFields`, `canEdit`, `actions`, `role` and `id` all carry over unchanged, and a sheet additionally accepts `drawerSide` and `drawerSize`. The `dataSource` is what makes it record-bound, so the renamed sheet still answers the same `openSheet` row-click.

#### Moving between records

`navigation.siblings: true` adds Previous and Next to a record sheet opened from a table row. They sit in the sheet's header beside its title, and under the title the header says where the record stands in that list ("2 of 3"), counted through the whole list the table reads, across its groups, so the first row of its second page of 25 reads "26 of 28", and the next one "27 of 28" after a step. They step through the rows that table shows, in its current order, filter, grouping and page, and the address follows, so each step is a link. A sheet opened from its address alone has no list to step through and draws neither steps nor a place. `navigation.fullPage` adds an "Open full page" link to the record's own page, written with `$record.id`. Previous, Next, the record's place, the link and the name the navigation is announced by are in the page language, as is the name of the banner a sheet shows when it refuses a save.

## `popover`

A floating panel anchored to a trigger, opened on click. Reference: shadcn/ui Popover. `props.title` and `props.description` head the panel.

<!-- sovrium:options type:popover -->

`floatingSide` is the preferred side relative to the trigger — `top`, `right`, `bottom`, `left` — and `floatingAlign` the alignment along it: `start`, `center`, `end`.

## `tooltip`

A small hover hint anchored to a trigger. Reference: shadcn/ui Tooltip. It draws a small arrow pointing at its trigger.

<!-- sovrium:options type:tooltip -->

## `hover-card`

A richer popover that opens on hover, for a profile preview or a link peek. Reference: shadcn/ui Hover Card.

<!-- sovrium:options type:hover-card -->

`openDelay` and `closeDelay` are milliseconds before it opens on hover and before it closes after the pointer leaves.

## `toast`

A transient notification. Reference: shadcn/ui Sonner, which shadcn/ui now recommends in place of its earlier toast; this one component stands for both (Reference: shadcn/ui Toast). Toasts are usually emitted from an action's `onSuccess` or `onError` handler rather than placed in the tree directly; page-level placement is configured on the page itself.

A toast placed in the tree is drawn where it is written, with `content` as its text. `toastVariant` is its tone — `success`, `error`, `warning`, `info` or `loading`; `duration`, in milliseconds, removes it once that time has passed, and without one it stays; `actionLabel` together with `actionUrl` adds an action button that posts once to that URL and closes the toast. An `onError` toast that names an `actionLabel` and no `actionUrl` offers that label as a Retry: pressing it closes the toast and runs the same action again — the same request, then its own `onSuccess` or `onError` — without asking its confirmation a second time. The toasts an action raises from its `onSuccess` or `onError` follow the rules below: their `duration` defaults to 5000, and two kinds are left off the timer: one whose `variant` is `error` or `destructive`, and one that renders an action button. A failure nobody read is a failure that did not happen, and an action that expires before it is reached is not an action.

Neither one is stranded either. A toast that is not on a timer carries a close button, and `Escape` clears the most recent one, so a reader who is done with it never has to leave it holding the corner of the screen. Each kind still ends its own way as well: an action toast goes when its button is used, and any toast goes when the page changes. A toast that does expire on its own carries no close button. An `error` or `destructive` toast is also announced urgently to assistive technology, interrupting whatever is being read; every other toast waits its turn. An explicit `duration` overrides all of this, an error included. Multiple toasts stack without overlapping.
