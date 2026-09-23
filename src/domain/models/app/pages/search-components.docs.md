# Search Components

> The components that put a search box on a page — `search-input` and its two scopes, the `list` result display, the ⌘K palette, and the in-component toolbar box.

Tables declare what is searchable and a binding declares how a query runs (**Search Overview**). These are the components that let a visitor type one.

| Component         | What it is                                                                      |
| ----------------- | ------------------------------------------------------------------------------- |
| `search-input`    | A search box, in one of two scopes: it publishes a query, or it searches pages. |
| `list`            | A search-first result display with item templates, highlighting and load-more.  |
| `command-palette` | The ⌘K overlay, placed by you rather than appended by the engine.               |
| toolbar `search`  | An in-component box on `table`, `kanban` and `calendar`.                        |

## `search-input`, and why `scope` is required

One component draws every search box, and `scope` says what the box searches. The two mechanisms look identical in the markup and behave nothing alike:

| `scope`         | What the box searches                                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'subscribers'` | Nothing on its own. It publishes the query, and sibling components whose `dataSource.bindTo` names this input's `props.id` apply it to their own records.        |
| `'page'`        | The content of your public pages, through a prebuilt static index and its own results panel — a different layer from record search, which reads your table rows. |

`scope` has **no default, deliberately**. A default would hand an author who omitted the key the other mechanism, silently: an input publishing to nobody, or a search box with no index behind it. Neither failure shows up as an error — the box renders, and simply never finds anything. The cost of requiring the key is paid once, at the migration the two retired type names (`searchInput`, `pageSearch`) force anyway.

A key belonging to the other scope is **ignored, not rejected**: `maxResults` under `scope: subscribers` validates and does nothing, as do `debounceMs` and `minQueryLength` under `scope: page`. The full option table sits with the rest of the content components, in **Content Components**.

### `scope: subscribers` — driving a sibling

```yaml
name: my-app
tables:
  - name: products
    fields:
      - { name: name, type: single-line-text }
      - { name: description, type: long-text }
pages:
  - name: Products
    path: /products
    components:
      - type: search-input
        scope: subscribers
        debounceMs: 300
        minQueryLength: 2
        props: { id: product-query }
      - type: list
        dataSource:
          table: products
          mode: search
          searchFields: [name, description]
          bindTo: product-query
        listDisplay:
          itemTemplate: { title: $record.name, subtitle: $record.description }
          highlight: true
```

`props.id` is the container's DOM id, and `bindTo` names it; the subscriber resolves the `<input>` inside. `placeholder` is read from `props` too.

`debounceMs` and `minQueryLength` are top-level fields of the component — siblings of `props`, not members of it — and they are **consumed by the subscribers, not by the input**. They describe the query stream the input publishes, so declaring them once governs every component bound to it. A subscriber that also sets `dataSource.debounceMs` uses the publisher's value; the binding's own delay is for a component that renders its own box instead of binding to one. Below `minQueryLength` the subscriber shows its unfiltered baseline rather than freezing on the last query, and clearing the box always restores that baseline.

### `scope: page` — the static public-page index

```yaml
name: my-app
pages:
  - name: Home
    path: /
    components:
      - type: search-input
        scope: page
        placeholder: Search the site...
        maxResults: 10
```

**The scope is the switch.** The moment a `search-input` with `scope: page` appears anywhere in the page tree, `sovrium build` and `sovrium start` emit the index; no environment variable and no top-level configuration is involved. A `scope: subscribers` input builds nothing, so an app full of bound filter boxes pays no index cost.

What gets emitted, under `<outputDir>/sovrium-search/`, is a JSON index and a small runtime the box queries in the browser. The index is TF-IDF over each page's text, with a double weight for words that also appear in the page title, and it carries a short excerpt per page.

What gets indexed is narrower than "every page", in three ways worth knowing before you rely on it:

- **Public pages only** — `access` omitted or `access: 'all'`. A page gated by `access: 'authenticated'`, by a role array or by a `require` rule is absent from the index, and `sovrium build` emits no static HTML for it either.
- **No underscore paths.** A path beginning `/_` stays out, on the same convention that keeps it out of the static build.
- **No chrome.** Only the page's `<main>` region is read, so a word from your header, nav or footer does not match on every page at once, and each excerpt is about the page rather than about the layout.

## `list` — the result display

`list` is designed as a search-first display and is the natural companion for a subscriber-scoped input: one item template per record, optional highlighting of the matched terms, dividers, and a load-more control.

<!-- sovrium:options ListDisplaySchema depth=2 -->

```yaml
name: my-app
tables:
  - name: products
    fields:
      - { name: name, type: single-line-text }
      - { name: description, type: long-text }
      - { name: thumbnail, type: single-attachment }
      - { name: category, type: single-line-text }
      - { name: price, type: currency, currency: EUR }
pages:
  - name: Products
    path: /products
    components:
      - type: list
        dataSource:
          table: products
          mode: search
          searchFields: [name, description]
          bindTo: product-query
        listDisplay:
          itemTemplate:
            title: $record.name
            subtitle: $record.description
            image: $record.thumbnail
            badge: $record.category
            metadata:
              - { field: price, format: currency }
          emptyMessage: No products found
          loadMore: infinite
          highlight: true
          divider: true
          maxItems: 50
```

`highlight` wraps matched terms in the rendered item text and is off by default.

## The ⌘K palette

Sovrium appends its own command palette to every page and binds ⌘K / Ctrl+K to it. You get it for nothing — no configuration at all — and it searches every table you may read, plus your own pages. **Search Overview** has what it returns and who sees what.

### Switching it off app-wide

That becomes a problem exactly once: when your app ships its own ⌘K overlay, because both open on the same keystroke.

<!-- sovrium:options PaletteSchema -->

```yaml
name: my-app
palette: { enabled: false }
```

With `enabled: false` no palette is rendered and no global keybinding is registered, leaving the keystroke free. Leave the block out entirely unless you are opting out.

### Placing one yourself

Appending it everywhere and switching it off app-wide are two coarse states, and neither can say _the palette on this page searches my endpoint_. Declaring a `command-palette` component is the third: a page carrying one keeps exactly that palette, and the engine appends nothing on top — two palettes on one keystroke open two overlays.

It renders no visible markup. The overlay is built in the browser on the first ⌘K and cached, so the page carries only a configuration block and its runtime.

<!-- sovrium:options CommandPaletteSearchSchema -->

```yaml
name: my-app
pages:
  - name: Shell
    path: /
    components:
      - type: command-palette
        search:
          endpoint: /api/my-search
          placeholder: Search everything
          kindLabels: { record: Records, form: Forms }
```

Omit `search` and you get the built-in quick actions — go to a page, create a record, toggle dark mode — placed where you put the component rather than appended. Declaring `search` **replaces** them: a mode, not an addition, for the same one-keystroke reason.

The endpoint is one you write. The value must be a path on this instance: anything not starting with `/` is refused, so `sovrium validate` catches a cross-origin value offline instead of the palette querying somewhere else at runtime. It is **not** the engine's own `/api/command-search`, whose response is a different shape.

The palette appends `?q=<term>` (or `&q=` when your path already carries a query string), sends the request with credentials, and expects results **already grouped**:

```json
{
  "query": "acme",
  "groups": [
    {
      "type": "record",
      "results": [
        {
          "type": "record",
          "entityId": "42",
          "title": "Acme Corp",
          "href": "/customers/42",
          "updatedAt": "2026-09-23T08:00:00.000Z"
        }
      ]
    }
  ]
}
```

`title` is the row's text, `href` is where selecting it navigates, and `type` plus `entityId` identify the row. `kindLabels` turns a GROUP's `type` into its heading, so the list reads as nouns rather than tokens; a `type` the map does not name prints as itself. Anything that is not a `200` carrying this shape renders the no-results state — the palette never reports a fetch error to the visitor.

## The in-component search box

A data component can draw its own search bar instead of being driven by a separate input. On a `table`, `toolbar.search: true` renders a box over the bound rows, which issues a `?q=` request rather than filtering the loaded page — see **Search Overview**. `toolbar` also carries `filters`, `sort`, `export`, `refresh`, `density`, `columnToggle`, `groupBy`, `views` and `viewSwitcher`; **Data Tables** documents the set.

```yaml
name: my-app
tables:
  - name: orders
    fields:
      - { name: customer, type: single-line-text }
      - { name: reference, type: single-line-text }
pages:
  - name: Orders
    path: /orders
    components:
      - type: table
        dataSource: { table: orders }
        toolbar: { search: true, filters: true, sort: true }
```

`kanban` and `calendar` take a `search` block instead — `enabled`, `placeholder`, `debounceMs`, `highlight` — documented with the other shared component modules in **Component Model**.

## Related reading

- **Search Overview** — the four mechanisms and which one a configuration reaches.
- **Full-Text Search** — `indexed` and `fullTextSearch` on a field.
- **Content Components** — the `search-input` option table.
- **Data Tables** — the grid, its toolbar and its columns.
- **Data Components** — every component a `dataSource` can drive.
