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
