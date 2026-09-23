# Search Overview

> The four places a query runs in Sovrium — a bound component, the records endpoint, the ⌘K palette, and the static public-page index — and which one a given configuration reaches.

Search is not a feature domain with a configuration block of its own. There is no `app.search`: a table declares what is searchable, a component declares where a search box appears, and each query runs in the place that owns the data. Everything happens inside your own database or inside the visitor's browser — no Elasticsearch, no hosted index, no third-party service to sign up for.

## Four mechanisms, and what each one searches

| Mechanism         | Declared by                                      | Runs                                                         | Searches                                 |
| ----------------- | ------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------- |
| Bound-component   | `dataSource.mode: search` on a data component    | in the browser, over the records the page already fetched    | one table                                |
| Records endpoint  | `?q=` on `GET /api/tables/<table>/records`       | in the database, as a case-insensitive substring match       | one table                                |
| Command palette   | ⌘K, on by default; `command-palette` to place it | in the database, over the palette's own full-text index      | every table you may read, and your pages |
| Public-page index | `search-input` with `scope: page`                | in the browser, over a static index built at `build`/`start` | the text of your public pages            |

The first two read RECORDS, the last reads PAGE CONTENT, and the palette reads both. They are different features at different layers, and a visitor cannot tell which one a box in front of them is using — so the choice is yours to make deliberately.

## `mode: 'search'` — searching a bound component

A data component whose binding declares `mode: search` becomes an interactive search surface. The server resolves the binding once, applying `filter`, `sort` and `fields`, and hands the resulting set to the component. The visitor's typing then narrows that set in the browser, throttled by `debounceMs` and capped by `limit`.

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
      - type: table
        dataSource:
          table: products
          mode: search
          searchFields: [name, description]
          debounceMs: 300
          limit: 20
```

Every property of the binding — `searchFields`, `debounceMs`, `limit`, `bindTo`, `filter`, `sort`, `refreshMode` — is documented once in **Data Binding**, beside the rest of `dataSource`.

The whole bound set travels to the browser, so this mode suits a reference list, a picker or a category of a few hundred rows. Past that, narrow it with `filter` first, or reach for the records endpoint below, which searches in the query and therefore finds a match that sits on a page the visitor has not loaded.

### What `searchEngine` selects

`searchEngine` accepts four values, and `client` is both the default and the one the bound-component mode implements:

| Engine    | Intended backend                       | Status                                                             |
| --------- | -------------------------------------- | ------------------------------------------------------------------ |
| `client`  | Browser JavaScript over fetched rows   | **Implemented.** The default when the key is omitted.              |
| `fts`     | PostgreSQL `tsvector` / `tsquery`      | Accepted by `sovrium validate`; not yet dispatched by the binding. |
| `trigram` | PostgreSQL `pg_trgm`, typo-tolerant    | Accepted by `sovrium validate`; not yet dispatched by the binding. |
| `hybrid`  | Ranked full text with a fuzzy fallback | Accepted by `sovrium validate`; not yet dispatched by the binding. |

A component declaring `fts`, `trigram` or `hybrid` validates, starts and searches exactly as `client` does. The values are reserved so that a configuration written today keeps its stated intent when the server-side engines land; nothing in your app breaks either way, and nothing about it gets faster yet. Where you need the DATABASE to do the searching now, use one of the other three mechanisms.

## `?q=` — searching in the query

`GET /api/tables/<table>/records?q=<term>` searches in SQL, across the whole table rather than across one loaded page, so the total the response reports is the count of MATCHING rows and the pager offers only pages that still exist.

Three things decide what it can match:

- **Field type.** Only text-shaped fields are searched: `single-line-text`, `long-text`, `rich-text`, `email`, `url`, `phone-number`, `single-select`, `status`, `code` and `barcode`. A substring match against a number, a date or a boolean is not meaningful, and on PostgreSQL it is an outright error.
- **Computed fields are excluded**, even when they render as text. `formula`, `lookup`, `rollup` and `count` are view expressions rather than stored columns.
- **Field-level read permission.** The searchable columns are filtered through the same rule that shapes the response, so a term can never match on a value the caller would not have been shown. Otherwise the mere presence of a row in the results would disclose a hidden field.

A term with nowhere to match returns nothing rather than the unfiltered table. **Records: Filtering & Sorting** documents the parameter; the `table` component's toolbar search box issues exactly this request.

## The command palette — searching every table, and your pages

Sovrium appends a ⌘K / Ctrl+K palette to every page. Its search is the one query in the product that crosses tables, and it answers from `GET /api/command-search`.

It returns two kinds of result, pages ahead of records:

- **Pages.** Your declared pages matched on title and name, and your `contentDir` articles matched on title, slug or body. A body match carries a short plain-text excerpt around the term, so the palette can highlight it. A page whose path holds a `:param` segment is skipped: it is a record-detail template rather than a destination of its own.
- **Records.** The text columns of every table the caller may read, over a full-text index the engine maintains for it — a GIN index over `to_tsvector('simple', …)` on PostgreSQL, an FTS5 virtual table kept fresh by triggers on SQLite. Records the caller has favourited rank above the rest.

The record half reads a narrower set of field types than `?q=` does: only `single-line-text`, `long-text`, `rich-text`, `email` and `url`. One answer is capped per source — ten declared pages, ten content articles, twenty-five records — so a short query against a large documentation corpus cannot serialise the whole of it into an overlay that renders about ten rows.

A query shorter than two characters answers `200` with an empty list rather than an error: a palette types into this endpoint one character at a time, and an error state mid-typing would be rendered for someone who has done nothing wrong. A single letter also selects a large fraction of every text column of every table, and the second character is roughly twenty-six times more selective.

Who sees what depends on the session. With no `auth` block the scan is unrestricted, as every other read surface is. With `auth` configured and no session the palette returns **pages only** — not a `401`, because a public documentation search is one of the things it is for, and page results are content the server already renders publicly. A signed-in caller additionally gets rows scoped by their read permissions. Every answer carries `Cache-Control: private, max-age=10`, because the favourite ordering is specific to one session and must never reach a shared cache.

**Search Components** covers placing a palette yourself and pointing it at your own endpoint.

## Public pages — a static index

A `search-input` with `scope: page` searches the TEXT OF YOUR PAGES rather than any table. `sovrium build` and `sovrium start` emit a small index and a client runtime, and the box queries them in the browser. Only public pages are indexed. **Search Components** has the mechanics.

## Choosing an approach

| Need                                                 | Reach for                                                 |
| ---------------------------------------------------- | --------------------------------------------------------- |
| Narrow a small bound list already on the page        | `dataSource.mode: search`                                 |
| Find a row that may sit on any page of a large table | `?q=`, or a `table` with `toolbar.search: true`           |
| Search across every table at once                    | the ⌘K palette                                            |
| Search the content of your public pages              | `search-input` with `scope: page`                         |
| Declare which fields are worth indexing              | `indexed` and `fullTextSearch` — see **Full-Text Search** |

## Related reading

- **Search Components** — `search-input` and its two scopes, the `list` display, the palette, the toolbar box.
- **Full-Text Search** — what `indexed` and `fullTextSearch` emit, per dialect.
- **Data Binding** — every `dataSource` property, including the search ones.
- **Records: Filtering & Sorting** — the `?q=`, `filter` and `sort` query parameters.
- **Data Components** — `table`, `kanban`, `calendar`, `list` and their toolbars.
