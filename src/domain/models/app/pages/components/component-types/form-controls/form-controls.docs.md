# Text & Choice Controls

> The fourteen text and choice inputs — input, input-otp, input-group, textarea, rich-text-editor, code-editor, select, combobox, native-select, checkbox, radio-group, switch, toggle and toggle-group — plus the field wrapper that labels any of them.

Form controls are the individual inputs a form is built from. They sit inside a `form`, or stand alone inside any container.

```yaml
pages:
  - name: Signup
    path: /signup
    components:
      - type: form
        endpoint: { url: /api/signups, method: POST, submitLabel: Sign up }
        children:
          - { type: input, inputType: email, props: { name: email } }
          - { type: select, options: [{ label: Free, value: free }], props: { name: plan } }
```

**For most controls, `name` is a `props` entry rather than a schema field.** `input`, `textarea`, `select`, `checkbox`, `radio-group`, `switch` and the toggles do not declare `name` in their schemas; it passes through the free-form `props` bag unvalidated, so a typo submits under the wrong key rather than failing validation.

Four controls do declare it — `input-group`, `rich-text-editor`, `code-editor` and `date-range-picker` — because each keeps a hidden input of its own and has to know what to key it by. Writing `name` at the top level of one of those is validated; writing it in their `props` is not. Where you can, prefer the `fields` of a form bound to a table either way — a `forms[]` entry, or a page `form` that edits a record through `dataSource`: each field **is** validated against the bound table.

## `input`

A single-line text input. Reference: shadcn/ui Input. The HTML input type is the schema-level `inputType` property, not `props.type`.

<!-- sovrium:options type:input -->

`inputType` is `text` by default, or `email`, `password`, `number`, `tel`, `url` or `search`. A one-time code is its own type, [`input-otp`](#input-otp); `inputType: one-time-code` is refused with a message naming it. Placeholder, default value, disabled and required all travel through `props`.

## `input-otp`

The box a mailed verification code is typed back into. Reference: shadcn/ui Input OTP. It takes only the shared `props`, `classes`, `visibility` and `i18n` keys, and carries `autocomplete="one-time-code"` and a numeric keyboard, which is what lets a phone offer the code it just received. `inputType` is refused: an `input-otp` is always a one-time code.

## `input-group`

One input with a fixed prefix, suffix, or action fused to its edge. Reference: shadcn/ui Input Group. The field and its addons share one box: the border, the corners and the focus ring belong to the group, not to the input inside it. `prefix` and `suffix` are the inline text shorthand; `addons` places icons (`icon`), key hints (`kbd`) or text before or after the control (`align: inline-start`, the default, or `inline-end`), or above or below it (`block-start`, `block-end`), and none of them is ever part of the value. `control: textarea` holds a multi-line control instead of an input. The `action` link takes a button `variant` (`ghost` by default) and `size` (`xs` by default, `sm`, `icon-xs` or `icon-sm`).

<!-- sovrium:options type:input-group -->

```yaml
components:
  - type: input-group
    label: Amount
    name: amount
    inputType: number
    prefix: '€'
    suffix: 'excl. VAT'
  - type: input-group
    label: Workspace
    name: subdomain
    prefix: 'https://'
    suffix: '.sovrium.com'
    action: { label: Check, href: /availability }
```

**An addon is never part of the value.** `prefix` and `suffix` sit **outside** the `<input>`. A `€` prefix is drawn against the field and is not submitted with it, so the record stores `4120.00` rather than `€4120.00` and nothing downstream has to strip a currency sign back off. That is the whole reason to reach for this over an `input` whose placeholder merely mentions the unit.

The label is bound to the input, not to an addon — an addon is not a control, and must not be what a screen reader announces as the field.

## `textarea`

A multi-line text input. Reference: shadcn/ui Textarea. It grows with what is written.

<!-- sovrium:options type:textarea -->

## `rich-text-editor`

Formatted prose, written in place, with only the marks you allow. Reference: shadcn/ui Input Group. The editor and its toolbar share one frame, ringed while the text has focus; each action is a ghost toggle showing its glyph, named for assistive technology and shown on the muted surface while it is on, with a rule between groups of actions.

<!-- sovrium:options type:rich-text-editor -->

The toolbar vocabulary is closed — `bold`, `italic`, `strike`, `heading`, `list`, `ordered-list`, `code-block`, `blockquote`, `link`, `image`, `table`, `horizontal-rule` — so a typo is refused when the config is decoded rather than dropped silently at mount. Buttons render in the engine's own fixed order regardless of the order you list them in.

Omitting `toolbar` gives the default six: bold, italic, heading, list, link, code-block. An empty array is **not** the same statement and is legal: it means a toolbar-free editor, where the slash menu remains the way to reach every block action the toolbar would have enabled.

`value` is sanitised on the way in, so `$record.<field>` of stored rich text is safe. `imageBucket` defaults to the built-in `system` bucket, and the image button and paste handler insert the URL, never the bytes.

## `code-editor`

Source text the reader edits, highlighted by language and indented to your width. Reference: shadcn/ui Input Group. The editor sits in one frame, set in the monospace face with its line numbers in the muted foreground, and the frame is ringed while the source has focus.

<!-- sovrium:options type:code-editor -->

The eleven grammars are `javascript`, `typescript`, `jsx`, `tsx`, `json`, `html`, `css`, `sql`, `markdown`, `python` and `yaml`. Unlike the rich-text toolbar, `language` is deliberately **open**: an unrecognised value edits as plain text rather than failing the boot, because a grammar that does not ship yet is a worse reason to refuse a config than a formatting action that does not exist.

`minLines` is reserved **before** the grammar loads, which is what stops a form settling twice as its editors arrive. `maxLines` must not be below it: the two bound the same box from opposite sides, so an inverted pair is refused at boot.

**Neither editor carries a submit control.** There is no Save button and no autosave. Both keep a hidden input under `name` holding their current value, exactly as a plain `input` does — the value goes to whatever form encloses the editor, and it is that form's own submit that writes it. An editor placed outside a form, or declared without `name`, is display-only. An editor that saved on its own would be the only control in the kit that writes without a form around it, and a page carrying two of them would have two independent save paths for one record.

## `select`

A dropdown showing the selected value and opening an option list on click. Reference: shadcn/ui Select. The list opens below the trigger, aligned to its left edge, and the page behind it stays scrollable.

<!-- sovrium:options type:select depth=3 -->

An option is `{ label, value, disabled, icon, group }`; `label` and `value` are required. Consecutive options sharing a `group` are listed under that group's label, which is no option; an interrupted group is drawn again where it resumes, so the written order is kept. `clearable: true` draws a clear control beside a chosen value, which returns the select to its placeholder.

A `select` is the styled control: it matches your design and can paint a per-option `icon`. For type-ahead, use [`combobox`](#combobox); for the browser's own `<select>`, use [`native-select`](#native-select). `searchable`, `searchPlaceholder` and `allowCustomValue` are refused on a `select`, each with a message naming `combobox`, and `native` with one naming `native-select`.

### Options from a table

Bind the select to a table and let each row become an option. `table` and `displayField` are required, `valueField` defaults to `id`, `filter` and `sort` narrow and order the rows, and `limit` defaults to 100 with a hard maximum of 1000.

```yaml
- type: select
  dataSource:
    table: categories
    displayField: name
    valueField: slug
    sort: [{ field: name, direction: asc }]
    filter: [{ field: archived, operator: eq, value: false }]
    limit: 50
  props: { id: category-filter, label: Filter by Category }
```

`options` and `dataSource` are **mutually exclusive** — both answer "what are the choices", so declaring the two together is refused at startup. `displayField` has no default on purpose: guessing would silently produce a dropdown of blank rows on any table that did not happen to match.

The rows are read on the **server**, before the page is sent, so the choices are in the first response — no empty flash on arrival, and crawlers see them. That also means the binding answers the records API's read rules for the visitor: one who may not read the table gets an empty dropdown, and not one of its row values reaches the page; one who may read it is offered only the rows the table's row-level read rule shows them. Filters accept `$currentUser.*` references, resolved per request, so a per-user option list is a supported binding.

Because the whole list is rendered into the page, `limit` caps it at 1000. A picker over a table larger than that is a different control — one that searches the table as you type — and is `record-picker` rather than this.

### Options from a system endpoint

Some choices are not rows of any table. The roles this app may assign, the automations it declares, the tables it defines — those are facts ABOUT the configuration, computed and served by a read endpoint.

```yaml
- type: select
  dataSource:
    system: { endpoint: /api/admin/roles, rowsKey: roles }
    labelKey: name
    valueKey: name
  props: { id: role-filter, label: Filter by role }
```

`system` and `labelKey` are required; `valueKey` defaults to the envelope's `idKey`, and `limit` again defaults to 100 with a hard maximum of 1000. The table-backed and endpoint-backed forms are alternatives, not a pair: a binding declaring both `table` and `system` is refused at startup.

Like the table form the rows are read on the **server**, with the visitor's own credentials, so a control never offers what its reader could not see — and the endpoint itself never reaches the page, which is what stops the delivered HTML from being an inventory of the admin surface.

### An "All" row

A filter bar's resting state is "everything". `emptyOption: { label }` adds that choice as the control's first option. Its submitted value is always the empty string — that is what "unset" means everywhere else in the platform, so a filter publishing it simply drops the parameter from the query. With no `defaultValue` declared, the row is the one selected when the page opens.

You need the key most when the choices come from a `dataSource`, because a binding replaces `options` and the two cannot be declared together — without it, a sourced filter opens on whichever row happened to sort first.

Two combinations are refused at startup because each would fail silently: `multiple: true`, since a multi-select says "none" by selecting nothing and an empty-valued option would join the selection instead; and an option that already submits `''`, since two choices with one value cannot be told apart when the selection is read back.

## `combobox`

One choice, or with `multiple: true` several, found by typing from a list that narrows with each keystroke. Reference: shadcn/ui Combobox.

<!-- sovrium:options type:combobox -->

It takes `select`'s options and data sources, and is always searchable: `searchPlaceholder` labels the search field and `allowCustomValue` accepts a typed value that matches no option. With `multiple: true` the field submits every chosen value under its `props.name`, one per value, and a pick made while filtering closes the list; `allowCustomValue` then does not apply. `chips: true` draws each chosen value as a chip inside the field, with a button that removes it; Backspace in the empty input removes the last one. `chips` requires `multiple: true` and is refused without it, and on a `select`. `searchable` and `native` are refused (the browser's own control is `native-select`).

## `native-select`

The browser's own `<select>`. Reference: shadcn/ui Native Select.

<!-- sovrium:options type:native-select -->

It takes the same `options`, `dataSource`, `emptyOption`, `defaultValue`, `multiple` and `publishes` as `select`, and suits dense, data-heavy screens such as a filter bar: it ships no JavaScript and is usable in the first response, even with scripting off; it is the platform's own accessible control, so a phone draws its own picker, and password managers, translation extensions, autofill and testing tools all key off the element. Keep `select` on a marketing page or a public form, where the control carries your design. `searchable`, `searchPlaceholder` and `allowCustomValue` are refused (type-ahead is [`combobox`](#combobox)), and so is an option `icon`, which an `<option>` element cannot paint.

## `checkbox`, `radio-group` and `switch`

A checkbox is a box the reader ticks, a radio group one choice among a few, all visible, and a switch a setting that applies as it flips. Reference: shadcn/ui Checkbox. Reference: shadcn/ui Radio Group. Reference: shadcn/ui Switch. Unchecked, each is outlined in the muted foreground, so it holds a 3:1 contrast against the page.

<!-- sovrium:options type:checkbox -->

`indeterminate` renders the mixed-state dash, for a parent whose children are partly selected.

<!-- sovrium:options type:radio-group -->

<!-- sovrium:options type:switch -->

Use `switch` when the change takes effect immediately, and `checkbox` when it takes effect on submit — the two look similar and read very differently to someone deciding whether to press Save.

## `toggle` and `toggle-group`

`toggle` is a single pressable button that stays pressed; `toggle-group` groups several. Reference: shadcn/ui Toggle. Reference: shadcn/ui Toggle Group. A group draws its items apart, each a toggle of its own, `spacing` steps apart (2 by default; `spacing: 0` joins them into one control), and `orientation` sets the axis they flow on and the arrow keys that move between them. `toggleVariant: outline` draws a toggle, or every item of a group, with a border; `default` is borderless.

<!-- sovrium:options type:toggle -->

<!-- sovrium:options type:toggle-group -->

## `field`

A wrapper that renders a label, a control, a description and an error message as one accessible unit. Reference: shadcn/ui Field. It is the only form control that takes `children`, and it is announced as a group; while `fieldError` or `errors` is set, the field's text, label and message included, is drawn in the destructive colour and its control is marked invalid. `errors` draws several messages as one list. `orientation` places the label above the control (`vertical`, the default), beside it (`horizontal`), or beside it on a wide screen and above it on a narrow one (`responsive`). `legend` makes the field a fieldset named by its legend, grouping the controls inside it. `fieldTitle` titles a choice control, such as a switch, beside it and above `fieldDescription`, and names it.

<!-- sovrium:options type:field -->

```yaml
- type: field
  fieldLabel: 'Email'
  fieldDescription: "We'll never share it."
  required: true
  children:
    - { type: input, inputType: email, props: { name: email } }
```
