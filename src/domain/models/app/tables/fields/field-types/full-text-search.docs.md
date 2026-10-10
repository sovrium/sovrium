# Full-Text Search

> What `indexed` and `fullTextSearch` actually emit into the database, how each dialect answers, and which of the product's searches reads an index.

A table declares what is worth indexing; a component decides where a query is typed. Two field properties are involved, and they do different jobs:

| Property         | Declared on          | What it does                                                                                    |
| ---------------- | -------------------- | ----------------------------------------------------------------------------------------------- |
| `indexed`        | every field type     | An ordinary index on the column, so filtering and sorting on it stay fast.                      |
| `fullTextSearch` | the `long-text` type | Makes the field searchable **by word**, from a full-text index, on SQLite and PostgreSQL alike. |
| `fullTextSearch` | the `rich-text` type | A PostgreSQL-only index over the field's text, which no search reads yet.                       |

Both are ordinary field properties and are listed with the rest of them — `indexed` in **Field Types Overview** among the base properties every type shares, `fullTextSearch` in **Text Fields** with the rest of `long-text` and `rich-text`.

## `indexed`

```yaml
name: my-app
tables:
  - name: articles
    fields:
      - { name: title, type: single-line-text, indexed: true }
      - { name: summary, type: long-text, indexed: true }
      - { name: tags, type: single-line-text, indexed: true }
```

Each indexed field gets one index named `idx_<table>_<field>`, created if it does not already exist, and dropped again when you remove the property and the schema is next synchronised. A `status` field is named `idx_<table>_status` rather than after the column.

The index TYPE follows the field type, and only on PostgreSQL:

- `array` and `json` fields get a GIN index, which is what makes a containment filter over them usable.
- `geolocation` fields get a GiST index.
- Everything else gets a B-tree.

SQLite has neither GIN nor GiST, so an `array`, `json` or `geolocation` field is simply left unindexed there — the column still works and every query still answers, it just scans. Every other type gets a plain index on both dialects.

What `indexed` buys you is faster `filter`, `sort` and foreign-key lookups on that column, paid for with slightly slower writes. It is **not** a prerequisite for any search: `?q=` either matches substrings or reads the full-text index `fullTextSearch` asks for, and the ⌘K palette maintains an index of its own. Index a field because you filter or sort on it often, not because you intend to search it.

## `fullTextSearch` on long text

A table of log lines, support messages or notes grows past the point where reading every row for each keystroke is acceptable. Declare the field you search:

```yaml
name: monitoring
tables:
  - name: logs
    fields:
      - { name: received_at, type: datetime }
      - { name: level, type: single-select, options: [debug, info, warn, error] }
      - { name: service, type: single-line-text }
      - { name: body, type: long-text, fullTextSearch: true }
```

From then on, `GET /api/tables/logs/records?q=…` — and every search box that issues it — answers from an index instead of a scan, and the meaning of `q` on that table changes in four ways:

- **It searches the declared fields only.** On a table declaring at least one `fullTextSearch` field, `q` no longer looks at the table's other text fields. Narrow those with `filter` instead (`level`, `service` above). A table declaring none keeps the substring search over all its text fields.
- **It matches words, not fragments.** A word is a run of letters and digits; everything else separates words, so `user_id=4821` holds the words `user`, `id` and `4821`. Each word of the query matches a word of the field that **starts** with it: `time` finds `timeout`, `imeou` finds nothing.
- **Every word must appear** in the same field, in any order. Text in double quotes is a phrase: its words must appear next to each other, in that order, matched whole — `"connection refused"` does not find _refused the connection_, and `"10.0.0.12"` finds that address however it is punctuated.
- **The most relevant line comes first** when the request gives no `sort`: the field where the query's words occur most often, then the newest record. A `sort` replaces relevance.

Case never matters. No other character has a meaning: a minus sign, a star, a colon, parentheses, `OR` or an unpaired quote are plain text, and a query with no word in it matches nothing. The search answers normally whatever the input — it cannot be made to fail by its syntax.

The usual rules still apply: only the declared fields the caller may read are searched, row-level rules and `filter` narrow the result, and the response has its usual shape, with `total` counting the matches.

### What it builds

| Database   | Index                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SQLite     | Nothing new: the engine already keeps an FTS5 table per table with text fields, updated by triggers on every write. The search reads the field's own column in it. |
| PostgreSQL | One GIN index per declared field, `idx_<table>_<field>_fulltext`, over the field's words (`to_tsvector('simple', …)` with punctuation turned into spaces).         |

Adding `fullTextSearch` to a field of a table that already holds rows is an ordinary schema change: the next start builds what is missing, and the rows written before are found at once. Removing it drops the PostgreSQL index and brings the substring search back. A backup restored with `sovrium restore` searches the same way after its first start.

Two differences between the databases are worth knowing. SQLite folds accents — `cafe` finds `café` — and PostgreSQL does not, so search with the spelling the text uses. And the two compute relevance with different formulas, so only the order is comparable, never a score.

## `fullTextSearch` on rich text

`rich-text` stores formatted HTML, and its flag still does what it did before long text had one: on PostgreSQL it emits a GIN index over `to_tsvector('english', <field>)`, named `idx_<table>_<field>_fulltext`, and on SQLite nothing. That is a stemming configuration (`quarterly` and `quarter` collapse to one token), and **no search reads it**: `q` keeps matching a rich-text field as a substring. It prepares the column for SQL you write yourself.

```yaml
name: my-app
tables:
  - name: articles
    fields:
      - { name: title, type: single-line-text, indexed: true }
      - name: body
        type: rich-text
        indexed: true
        fullTextSearch: true
        maxLength: 10000
        toolbar: [bold, italic, link, heading, list]
```

## PostgreSQL and SQLite

| Aspect                           | PostgreSQL                                             | SQLite                                          |
| -------------------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| Ordinary `indexed` field         | B-tree.                                                | B-tree.                                         |
| `array` / `json` / `geolocation` | GIN or GiST.                                           | No index; the column is unaffected.             |
| `fullTextSearch` on long text    | GIN over the field's words, read by `q`, ranked.       | The existing FTS5 table, read by `q`, ranked.   |
| `fullTextSearch` on rich text    | GIN over `to_tsvector('english', …)`, read by nothing. | Not emitted.                                    |
| Command-palette search           | GIN over `to_tsvector`, ranked.                        | An FTS5 table, with an escaped `LIKE` fallback. |

## Related reading

- **Search Overview** — the four search mechanisms and which one a configuration reaches.
- **Search Components** — the components that put a search box on a page.
- **Field Types Overview** — `indexed` and the other base properties every field shares.
- **Text Fields** — `rich-text`, `long-text` and the rest of the text family.
- **Table Indexes** — multi-column indexes declared on the table rather than on a field.
