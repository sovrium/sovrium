# Text & Choice Controls

> The eleven text and choice inputs — input, input-group, textarea, rich-text-editor, code-editor, select, checkbox, radio-group, switch, toggle and toggle-group — plus the field wrapper that labels any of them.

Form controls are the individual inputs a form is built from. They sit inside a `form`, or stand alone inside any container.

```yaml
tables:
  - name: signups
    fields:
      - { name: email, type: email }
      - { name: plan, type: single-select, options: [free, pro] }
pages:
  - name: Signup
    path: /signup
    components:
      - type: form
        action: { type: crud, operation: create, table: signups }
        children:
          - { type: input, inputType: email, props: { name: email } }
          - { type: select, options: [{ label: Free, value: free }], props: { name: plan } }
```

**For most controls, `name` is a `props` entry rather than a schema field.** `input`, `textarea`, `select`, `checkbox`, `radio-group`, `switch` and the toggles do not declare `name` in their schemas; it passes through the free-form `props` bag unvalidated, so a typo submits under the wrong key rather than failing validation.

Four controls do declare it — `input-group`, `rich-text-editor`, `code-editor` and `date-range-picker` — because each keeps a hidden input of its own and has to know what to key it by. Writing `name` at the top level of one of those is validated; writing it in their `props` is not. Where you can, prefer the `fields` array of a `form` that declares a `dataSource` either way: its `field` **is** validated against the bound table.

## `input`

A single-line text input. The HTML input type is the schema-level `inputType` property, not `props.type`.

<!-- sovrium:options type:input -->

`inputType` is `text` by default, or `email`, `password`, `number`, `tel`, `url`, `search`, or `one-time-code`. Placeholder, default value, disabled and required all travel through `props`.

`inputType: one-time-code` renders the box a mailed verification code is typed back into. It carries `autocomplete="one-time-code"` and a numeric keyboard, which is what lets a phone offer the code it just received — the whole difference between it and a plain text box.

## `input-group`

One input with a fixed prefix, suffix, or action fused to its edge.

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

A multi-line text input.

<!-- sovrium:options type:textarea -->

## `rich-text-editor`

Formatted prose, written in place, with only the marks you allow.

<!-- sovrium:options type:rich-text-editor -->

The toolbar vocabulary is closed — `bold`, `italic`, `strike`, `heading`, `list`, `ordered-list`, `code-block`, `blockquote`, `link`, `image`, `table`, `horizontal-rule` — so a typo is refused when the config is decoded rather than dropped silently at mount. Buttons render in the engine's own fixed order regardless of the order you list them in.

Omitting `toolbar` gives the default six: bold, italic, heading, list, link, code-block. An empty array is **not** the same statement and is legal: it means a toolbar-free editor, where the slash menu remains the way to reach every block action the toolbar would have enabled.

`value` is sanitised on the way in, so `$record.<field>` of stored rich text is safe. `imageBucket` defaults to `default`, and the image button and paste handler insert the URL, never the bytes.

## `code-editor`

Source text the reader edits, highlighted by language and indented to your width.

<!-- sovrium:options type:code-editor -->

The eleven grammars are `javascript`, `typescript`, `jsx`, `tsx`, `json`, `html`, `css`, `sql`, `markdown`, `python` and `yaml`. Unlike the rich-text toolbar, `language` is deliberately **open**: an unrecognised value edits as plain text rather than failing the boot, because a grammar that does not ship yet is a worse reason to refuse a config than a formatting action that does not exist.

`minLines` is reserved **before** the grammar loads, which is what stops a form settling twice as its editors arrive. `maxLines` must not be below it: the two bound the same box from opposite sides, so an inverted pair is refused at boot.

**Neither editor carries a submit control.** There is no Save button and no autosave. Both keep a hidden input under `name` holding their current value, exactly as a plain `input` does — the value goes to whatever form encloses the editor, and it is that form's own submit that writes it. An editor placed outside a form, or declared without `name`, is display-only. An editor that saved on its own would be the only control in the kit that writes without a form around it, and a page carrying two of them would have two independent save paths for one record.

## `select`

A dropdown showing the selected value and opening an option list on click.

<!-- sovrium:options type:select depth=3 -->

An option is `{ label, value, disabled, icon }`; `label` and `value` are required.

### The browser's own control

By default a `select` is a styled control: it matches your design, it can paint a per-option `icon`, and it can grow a type-ahead field. `native: true` gets the browser's own `<select>` instead. Reach for it on dense, data-heavy screens — a filter bar that offers a list and reads a value back:

- **It ships no JavaScript.** The styled control is drawn in the browser; the native one is in the first response and is usable immediately, including with scripting turned off.
- **It is the platform's own accessible control.** A phone draws its own picker, and the browser's type-ahead works with nothing of ours in the way.
- **The whole ecosystem addresses it** — password managers, translation extensions, form autofill and browser testing tools all key off the element.

Keep the default everywhere else. It is the control your visitors see on a marketing page or a public form, and it is the one that carries your design.

`native` refuses three combinations when your config is read, rather than dropping them in silence: `searchable` names a different control — the type-ahead combobox; `allowCustomValue`, because the native control offers only its declared options; and an option `icon`, because an `<option>` element cannot paint a glyph. `multiple` **is** allowed: a multi-select is a real browser control.

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

The rows are read on the **server**, before the page is sent, so the choices are in the first response — no empty flash on arrival, and crawlers see them. That also means the table's read permission gates the binding: a visitor who may not read the table gets an empty dropdown, and not one of its row values reaches the page. Filters accept `$currentUser.*` references, resolved per request, so a per-user option list is a supported binding.

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

### There is no `combobox` type

A searchable dropdown is `select` with `searchable: true`, which also accepts `searchPlaceholder` and `allowCustomValue`. That is a decision rather than a gap: a combobox and a select differ by whether you can type into them, which is one boolean — and splitting them would give two components sharing every option, every keyboard behaviour and every listbox token, while forcing an author who adds search to an existing dropdown to change its type rather than set a flag.

## `checkbox`, `radio-group` and `switch`

<!-- sovrium:options type:checkbox -->

`indeterminate` renders the mixed-state dash, for a parent whose children are partly selected.

<!-- sovrium:options type:radio-group -->

<!-- sovrium:options type:switch -->

Use `switch` when the change takes effect immediately, and `checkbox` when it takes effect on submit — the two look similar and read very differently to someone deciding whether to press Save.

## `toggle` and `toggle-group`

`toggle` is a single pressable button that stays pressed; `toggle-group` groups several.

<!-- sovrium:options type:toggle -->

<!-- sovrium:options type:toggle-group -->

## `field`

A wrapper that renders a label, a control, a description and an error message as one accessible unit. It is the only form control that takes `children`.

<!-- sovrium:options type:field -->

```yaml
- type: field
  fieldLabel: 'Email'
  fieldDescription: "We'll never share it."
  required: true
  children:
    - { type: input, inputType: email, props: { name: email } }
```
