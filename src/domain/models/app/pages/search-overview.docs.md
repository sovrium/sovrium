# Search Overview

> The four places a query runs in Sovrium — a bound component, the records endpoint, the ⌘K palette, and the static public-page index — and which one a given configuration reaches.

Search is not a feature domain with a configuration block of its own. There is no `app.search`: a table declares what is searchable, a component declares where a search box appears, and each query runs in the place that owns the data. Everything happens inside your own database or inside the visitor's browser — no Elasticsearch, no hosted index, no third-party service to sign up for.

## Four mechanisms, and what each one searches

| Mechanism         | Declared by                                      | Runs                                                                                         | Searches                                 |
| ----------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Bound-component   | `dataSource.mode: search` on a data component    | in the browser over the fetched records, or in the database with `searchEngine: fts`         | one table                                |
| Records endpoint  | `?q=` on `GET /api/tables/<table>/records`       | in the database: by word from an index on `fullTextSearch` fields, else as a substring match | one table                                |
| Command palette   | ⌘K, on by default; `command-palette` to place it | in the database, over the palette's own full-text index                                      | every table you may read, and your pages |
| Public-page index | `search-input` with `scope: page`                | in the browser, over a static index built at `build`/`start`                                 | the text of your public pages            |

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

`searchEngine` accepts four values; `client` is the default:

| Engine    | What answers the visitor's query                    | Status                                                             |
| --------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| `client`  | Browser JavaScript, over the rows the page was sent | **Implemented.** The default when the key is omitted.              |
| `fts`     | The database, through the records endpoint's `?q=`  | **Implemented.**                                                   |
| `trigram` | Intended: typo-tolerant matching                    | Accepted by `sovrium validate`; searches exactly as `client` does. |
| `hybrid`  | Intended: ranked words with a fuzzy fallback        | Accepted by `sovrium validate`; searches exactly as `client` does. |

With `fts`, the page no longer carries the whole bound set: it renders the first `limit` rows the binding selects (at most 100, the endpoint's largest page, which is also the size used when `limit` is omitted), and each query the visitor types is sent to `GET /api/tables/<table>/records?q=…`, within the binding's own `filter`. What comes back is what `?q=` answers — a ranked word search when the table declares `fullTextSearch` fields, a substring search otherwise — so a search list over a table of a million log lines costs one indexed query per keystroke rather than a million rows in the page. Clearing the box brings back the first rows. `searchFields` does not narrow an `fts` search: the fields searched are the ones `?q=` searches.

```yaml
name: monitoring
tables:
  - name: logs
    fields:
      - { name: service, type: single-line-text }
      - { name: body, type: long-text, fullTextSearch: true }
pages:
  - name: Logs
    path: /logs
    components:
      - type: list
        dataSource:
          table: logs
          mode: search
          searchEngine: fts
          limit: 50
        children:
          - { type: text, content: '$record.body' }
```

## `?q=` — searching in the query

`GET /api/tables/<table>/records?q=<term>` searches in SQL, across the whole table rather than across one loaded page, so the total the response reports is the count of MATCHING rows and the pager offers only pages that still exist.

On a table declaring `fullTextSearch` on a `long-text` field, `q` is a ranked word search over the declared fields, read from an index — prefixes, phrases in double quotes, every word required. **Full-Text Search** documents that grammar. Everywhere else it is a case-insensitive substring match, and three things decide what it can match:

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

Who sees what depends on the session. With no `auth` block the scan is unrestricted, as every other read surface is. With `auth` configured and no session the palette returns **pages only**, and only the pages anyone may open — not a `401`, because a public documentation search is one of the things it is for. A page or `contentDir` article behind `access` answers only to a signed-in reader whose role may open it, filtered by the same check the router applies when they visit it. A signed-in caller additionally gets records, scoped exactly as the records endpoint scopes them: only the tables her role, her groups and — on a table with `rowLevelPermissions` — her `user_access` assignments let her read, only the fields she may read, and only the rows the table's row-level `read` rule admits for her. A row that rule hides never answers, not even by its label, and it never takes one of the twenty-five record slots from a row she may see; an admin is not narrowed by a row rule. Every answer carries `Cache-Control: private, max-age=10`, because the favourite ordering is specific to one session and must never reach a shared cache.

The command palette offers only the tables, the fields of each, and the rows of each, that the reader may read.

**Search Components** covers placing a palette yourself and pointing it at your own endpoint.

## Public pages — a static index

A `search-input` with `scope: page` searches the TEXT OF YOUR PAGES rather than any table. `sovrium build` and `sovrium start` emit a small index and a client runtime, and the box queries them in the browser. The static index holds public pages only; `index: session` makes the box ask the server instead, which answers with the pages the current reader may open. **Search Components** has the mechanics.

## Choosing an approach

| Need                                                 | Reach for                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| Narrow a small bound list already on the page        | `dataSource.mode: search`                                          |
| Find a row that may sit on any page of a large table | `?q=`, or a `table` with `toolbar.search: true`                    |
| Search across every table at once                    | the ⌘K palette                                                     |
| Search the content of your public pages              | `search-input` with `scope: page`                                  |
| Search a large text field by word, ranked            | `fullTextSearch` on a `long-text` field — see **Full-Text Search** |

## Related reading

- **Search Components** — `search-input` and its two scopes, the `list` display, the palette, the toolbar box.
- **Full-Text Search** — what `indexed` and `fullTextSearch` emit, per dialect, and the word-search grammar.
- **Data Binding** — every `dataSource` property, including the search ones.
- **Records: Filtering & Sorting** — the `?q=`, `filter` and `sort` query parameters.
- **Data Components** — `table`, `kanban`, `calendar`, `list` and their toolbars.
