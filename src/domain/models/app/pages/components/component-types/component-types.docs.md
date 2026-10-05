# The Component Model

> How Sovrium's component types are built — the tree, the property bag, and the category map that points at each reference page.

A page's `components` array is a tree. Every entry has a `type` — one of the ninety-one built-in component types — and a set of properties. Components do not each invent their own vocabulary: they compose from a small set of shared modules, so the same cross-cutting properties mean the same thing everywhere they appear.

```yaml
components:
  - type: container
    props: { className: 'max-w-4xl mx-auto' }
    children:
      - { type: text, element: h1, content: 'Tasks' }
      - type: table
        dataSource: { table: tasks }
```

`props` and `children` are universal. Everything else is opt-in per type: a `divider` carries `props` and `children` and nothing else, while a `container` adds `content`, `element`, `dataSource`, `responsive`, `visibility` and `i18n`. Each reference page below lists what its types actually accept, and the shared vocabulary is documented once in Shared Component Modules.

## Every component names its type and keeps its class

Every component names its type on the element it renders, in `data-component-type`, including components that render through an island and those that draw their own markup — a code block, a QR code, a progress bar, a skeleton, an empty state, a marquee, a theme toggle, a field and a time picker; a spec or a stylesheet finds a `select` or a `filter-bar` exactly as it finds a `text`. `props.className` lands on the component's own element for every component type, data components included. A stray character in one class list costs that class only; the rest of the page still paints.

A `sidebar` that declares `groups` is named on its navigation — the element holding its landmarks — rather than on the box around it, which also holds what you put beside the navigation; a sidebar without `groups` is named on its box.

An interactive component names its type on the element that hosts it, in the served page and once it is live — a drawer bound to a table and a sign-in form included. A sidebar that folds into a drawer (`drawer`) names what a phone draws: its box, drawn as the bar across the top, is a `container` and the menu button in it a `button`; the drawer it folds into keeps its own name, `drawer`, on its island host. A drawer is named once, whether closed or open; the panel it opens is not named a second time. While it is open, the element that names it carries `aria-controls` with the panel's `id`, so the panel is found from the drawer; closed, it points at nothing. A dialog and an alert dialog do the same: while open, the element that names them points at the open panel — the `id` you gave the dialog, or a generated one — and lets go once it closes.

A data component drawn by an island — a `kpi`, `chart`, `gallery`, `calendar` or timeline — is named once too, on that same host: it carries `data-component` beside `data-component-type`, and what describes the component sits there with them — a gallery's `data-columns` and `data-gallery-layout`, a calendar's `data-view`, a KPI's `data-kpi-state`. Nothing drawn inside the host repeats the name, and a KPI card or a timeline frame is the host itself.

The standard parts an island draws are named with the words the page uses for the same part outside an island: a table cell's status chip, an owner's initials disc and a progress bar are a `badge`, an `avatar` and a `progress`; a kanban card's footer chip and assignee disc a `badge` and an `avatar`; a list row's badge a `badge`; and the buttons of a calendar's toolbar each a `button`. The buttons, chips and form controls that drawers, dialogs, forms and tables draw carry the same `data-component-type` as the components that draw them on a page: a record drawer's tag chips are `badge`s and its actions `button`s, a form control is named after the control drawn — `input`, `select`, `textarea`, `date-picker`, `number-input`, `file-upload`, `checkbox`, or a drawer's `record-picker` — and a table's row actions are `button`s.

## Unknown keys are dropped, not rejected

A misspelled module name — `onClick` instead of `interactions.click`, `inline` instead of `inlineScripts` — passes validation and then does nothing. When a declared behaviour silently fails to appear, check the key against the reference page before checking the runtime.

## A `props` value may not be empty

The bag accepts a string, a number, a boolean, an object or an array — and nothing else. A key written with no value is refused, not treated as absent:

```
Expected string | number | boolean | object | array
```

That covers both spellings. In YAML, `props: { size: }` parses the value as empty and is refused. In a `.ts` config, so is an explicitly `undefined` value — which is what a conditional spread produces:

```ts
// refused: `size` is present, holding undefined
props: { size: isLarge ? 'lg' : undefined }
// accepted: the key is absent when there is nothing to say
props: { ...(isLarge ? { size: 'lg' } : {}) }
```

The key being absent is how you say nothing. A present key always has to carry a value.

## Categories

The types are documented by category, each on its own page. Twelve of these categories are also published as a live catalogue by the design-system console, which draws a specimen of every type beside its options; `custom` and `modules` are the two that are not, because one renders the operator's own HTML and the other renders nothing of its own.

| Category      | Types                                                                                                                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Interactive   | `alert`, `badge`, `button`, `button-group`, `link`, `theme-toggle`                                                                                                                                                     |
| Form controls | `checkbox`, `code-editor`, `date-picker`, `date-range-picker`, `field`, `input`, `input-group`, `radio-group`, `record-picker`, `rich-text-editor`, `select`, `slider`, `switch`, `textarea`, `toggle`, `toggle-group` |
| Data          | `calendar`, `chart`, `filter-bar`, `form`, `gallery`, `graph`, `kanban`, `kpi`, `list`, `matrix`, `table`                                                                                                              |
| Layout        | `card`, `container`, `flex`, `grid`, `sidebar`, `split-pane`                                                                                                                                                           |
| Content       | `audio`, `code`, `icon`, `iframe`, `image`, `kbd`, `qr-code`, `search-input`, `text`, `toc`, `video`                                                                                                                   |
| Display       | `accordion`, `avatar`, `description-list`, `empty-state`, `list-item`, `marquee`, `record-field`, `scroll-area`, `swatch`, `tabs`, `timeline`                                                                          |
| Navigation    | `breadcrumb`, `command-palette`, `context-menu`, `dropdown-menu`, `menubar`, `navigation-menu`, `pagination`                                                                                                           |
| Overlays      | `alert-dialog`, `dialog`, `drawer`, `hover-card`, `popover`, `toast`, `tooltip`                                                                                                                                        |
| Feedback      | `progress`, `skeleton`, `spinner`                                                                                                                                                                                      |
| Structural    | `divider`, `spacer`                                                                                                                                                                                                    |
| Specialty     | `comments`, `field-specimen`, `file-upload`, `language-switcher`, `number-input`, `preview`, `reorderable-list`, `specimen`, `time-picker`                                                                             |
| AI            | `ai-chat`                                                                                                                                                                                                              |
| Custom        | `customHTML`                                                                                                                                                                                                           |

A type name the catalogue does not hold is refused when the config is decoded, and a handful of names that used to be types are refused with the sentence that says what replaced them — `commentCount` became the `count` display of `comments`, and the four schema-editor types were withdrawn outright.

## Where a property is documented

Three places, and which one holds a property is decided by how many types it is true of.

- A property one type declares — `chartType`, `htmlSrc`, `swimlanes` — is on that type's category page, in the table walked out of the schema.
- A property every type in a category shares is on the same page, stated once above the tables.
- A subtracted shared module — `props`, `children`, `content`, `visibility`, `responsive`, `interactions`, `action`, `i18n` — is in Shared Component Modules and appears in no per-type table at all. A type's table lists what the type itself declares; those modules are subtracted before it is drawn, because printing them ninety times over would bury the thirteen rows that are actually about a button.
- `dataSource` is the one module that is **not** subtracted. Each of the sixteen types that accept it means something narrower by it — a `kpi` reads one aggregate where a `table` reads a page of rows — so it stays in those types' own tables, where its per-type description can be read, and Shared Component Modules describes only what they have in common.
