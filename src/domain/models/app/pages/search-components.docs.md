# Search Components

> The components that put a search box on a page: `search-input` and its two roles, the `list` result display, and where the ⌘K palette is documented.

Tables declare what is searchable and a binding declares how a query runs (**Search Overview**). These are the components that let a visitor type one.

| Component      | What it is                                                                     |
| -------------- | ------------------------------------------------------------------------------ |
| `search-input` | A search box, in one of two roles: it publishes a query, or it searches pages. |
| `list`         | A search-first result display with item templates, highlighting and load-more. |
| `command`      | The ⌘K overlay, placed by you rather than appended by the engine.              |

## `search-input`, and why it declares one role

One component draws every search box, and what it declares says what the box searches. The two mechanisms look identical in the markup and behave nothing alike:

| Declares                       | What the box searches                                                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `publishes: { bindTo, param }` | Nothing on its own. It publishes the query on a channel, and every data component subscribed to the channel narrows its own records to what the query matches.                                   |
| `scope: page`                  | Your pages, in its own results panel: by default the public ones through a prebuilt static index; with `index: session`, the ones the current reader may open, answered by the server per query. |

A box must declare **exactly one** of the two. A default would hand an author who declared neither the other mechanism, silently: an input publishing to nobody, or a search box with no index behind it. Neither failure shows up as an error: the box renders, and never finds anything. `scope: subscribers`, where a component named the box's id in its `dataSource.bindTo`, was removed in 0.39 and is refused at load, naming `publishes`.

A key belonging to the other role is **ignored, not rejected**: `maxResults` on a box that publishes validates and does nothing, as do `debounceMs` and `minQueryLength` under `scope: page`. The full option table sits with the rest of the content components, in **Content Components**.

### `publishes`: narrowing the data components

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
        publishes: { bindTo: products, param: q }
        debounceMs: 300
        minQueryLength: 2
        placeholder: Search products...
      - type: list
        dataSource: { table: products, bindTo: products, sharedFilter: {} }
        listDisplay:
          itemTemplate: { title: $record.name, subtitle: $record.description }
```

`bindTo` names a channel, not a component: every data component subscribed to `products` narrows to the records the records API's `?q=` matches, combined with every other control publishing on the same channel. A data component draws no search box of its own (a `search` key on one is refused at load), so the box above a grid, a board or a list is always a `search-input`; the library block `block/data-table-toolbar` places one with a facet, a filter bar, Export and New.

`debounceMs` and `minQueryLength` describe the query stream the box publishes, so declaring them once governs every component on the channel. Below `minQueryLength` the subscribers show their unfiltered rows rather than freezing on the last query, and clearing the box always restores them.

### The static public-page index: `scope: page`

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

**The scope is the switch.** The moment a `search-input` with `scope: page` appears anywhere in the page tree (including a breakpoint's `responsive.<bp>.children` and inside a shared component a page places), `sovrium build` and `sovrium start` emit the index; no environment variable and no top-level configuration is involved. A box that publishes builds nothing, so an app full of search boxes over its data pays no index cost.

What gets emitted is a JSON index and a small runtime the box queries in the browser, served at `/sovrium-search/index.json` and `/sovrium-search/runtime.js`. `sovrium build` writes them under `<outputDir>/sovrium-search/`, as part of the site it produces. `sovrium start` writes them under the data directory (`SOVRIUM_DATA_DIR`), beside the database, and serves them from there: starting an app never writes into its own folder, so `public/` holds only what you put in it. The index is TF-IDF over each page's text, with a double weight for words that also appear in the page title, and it carries a short excerpt per page.

What gets indexed is narrower than "every page", in three ways worth knowing before you rely on it:

- **Public pages only** (`access` omitted or `access: 'all'`) for the static index; see `index: session`. A page gated by `access: 'authenticated'`, by a role array or by a `require` rule is absent from the index, and `sovrium build` emits no static HTML for it either.
- **No underscore paths.** A path beginning `/_` stays out, on the same convention that keeps it out of the static build.
- **No chrome.** Only the page's `<main>` region is read, so a word from your header, nav or footer does not match on every page at once, and each excerpt is about the page rather than about the layout.

The box is driven from the keyboard while the focus stays in it: the arrow keys move a highlighted result, Enter opens it (the first result when none is highlighted), and Escape closes the panel, then clears the query when pressed again. A query nothing matches opens the panel on one line naming it, a polite status announces how many results are listed, and under `index: session` the panel says it is searching while a query is on its way, keeping the previous results until the answer replaces them. These words follow the page language, and an app renames them under `sovrium.search.searching`, `sovrium.search.noResultsFor`, `sovrium.search.resultCount` and `sovrium.search.resultCountOne`.

### The pages this reader may open: `index: session`

A box with `index: session` does not read the static file. Each query goes to `GET /api/search/pages?q=`, and the server answers with the pages the reader may open: public pages for a visitor who is not signed in, plus the gated pages and `contentDir` articles their role allows once they are. A page whose title holds the words is listed before one that only mentions them, whatever the collection order, and an article gated by the `access` in its own front matter is found only by the roles it names. The static index is untouched and stays public-only, so a public box and a session box can sit on the same site. An omitted `index` means `public`: forgetting the key gives a box that searches less than you meant, never more.

```yaml
name: my-intranet
auth:
  strategies:
    - type: emailAndPassword
pages:
  - name: Home
    path: /
    components:
      - type: search-input
        scope: page
        index: session
        placeholder: Search the intranet...
```

The server searches the text you wrote: each page's title and its text components, and each article's title and markdown, indexed on its first 16 KB. It never indexes a value rendered from a record, nor a part of a page bound to data or shown under `visibility`, so a reader cannot find a word they could not have read on the page. A component placed by reference contributes no text either. An article is found by whoever may open the page that publishes it, and a page embedding a form the reader may not use is left out, as the router refuses to open it for them. Answers carry at most ten results and `Cache-Control: private`, because they depend on who asks.

## `list`: the result display

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

A reader who may not read a field the list names searches and sees the list without it: a `searchFields` entry on that field is not searched, and an `itemTemplate` slot (`subtitle`, `badge` or any other) whose `$record.*` names it is left out. The page does not name the field.

## The ⌘K palette

Sovrium appends a command palette to every page and binds ⌘K / Ctrl+K to it, with no configuration. Switching it off app-wide with `palette`, and placing one yourself with a `command` component that searches your own endpoint, are both in **Command Palette**.

## Related reading

- **Search Overview**: the four mechanisms and which one a configuration reaches.
- **Command Palette**: the ⌘K overlay, switching it off, and placing your own.
- **Full-Text Search**: `indexed` and `fullTextSearch` on a field.
- **Content Components**: the `search-input` option table.
- **Data Tables**: the grid, its columns and the controls composed above it.
- **Data Components**: every component a `dataSource` can drive.
