# Full-Text Search

> What `indexed` and `fullTextSearch` actually emit into the database, how each dialect answers, and which of the product's searches reads an index.

A table declares what is worth indexing; a component decides where a query is typed. Two field properties are involved, and they do different jobs:

| Property         | Declared on          | What it emits                                                                    |
| ---------------- | -------------------- | -------------------------------------------------------------------------------- |
| `indexed`        | every field type     | An ordinary index on the column, so filtering and sorting on it stay fast.       |
| `fullTextSearch` | the `rich-text` type | A PostgreSQL full-text index over the field's text content, on top of `indexed`. |

Both are ordinary field properties and are listed with the rest of them — `indexed` in **Field Types Overview** among the base properties every type shares, `fullTextSearch` in **Text Fields** with the rest of `rich-text`.

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

What `indexed` buys you is faster `filter`, `sort` and foreign-key lookups on that column, paid for with slightly slower writes. It is **not** a prerequisite for any of the searches that ship: `?q=` scans whatever text-shaped columns the caller may read, and the ⌘K palette maintains an index of its own. Index a field because you filter or sort on it often, not because you intend to search it.

## `fullTextSearch`

`rich-text` stores formatted HTML rather than plain text, which is why it is the one type carrying this flag. Setting it emits a second, different index — a GIN index over `to_tsvector('english', <field>)`, named `idx_<table>_<field>_fulltext`:

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

That index is **PostgreSQL only**. On SQLite nothing is emitted, the property still validates, and the field behaves in every other respect as it does on Postgres.

Two things follow from `to_tsvector('english', …)` that are worth stating plainly, because neither is visible from the configuration:

- **It is a stemming configuration.** `quarterly` and `quarter` collapse to one token, which helps a prose search and hurts an exact-token one.
- **Nothing in the engine queries it yet.** The record searches that ship take other routes — `?q=` performs a substring match in SQL, and the ⌘K palette reads its own index, built with a non-stemming configuration over every table. Declaring `fullTextSearch` today prepares the column and makes the index available to SQL you write yourself; it does not change what a `search-input` or a toolbar box returns. **Search Overview** has the full map of which mechanism runs where.

Plain `long-text` and `single-line-text` need no flag at all. They are already plain text, so `indexed: true` is the whole story for them.

## PostgreSQL and SQLite

| Aspect                           | PostgreSQL                            | SQLite                                          |
| -------------------------------- | ------------------------------------- | ----------------------------------------------- |
| Ordinary `indexed` field         | B-tree.                               | B-tree.                                         |
| `array` / `json` / `geolocation` | GIN or GiST.                          | No index; the column is unaffected.             |
| `fullTextSearch` on rich text    | GIN over `to_tsvector('english', …)`. | Not emitted.                                    |
| Command-palette search           | GIN over `to_tsvector`, ranked.       | An FTS5 table, with an escaped `LIKE` fallback. |

SQLite is Sovrium's zero-config default and answers every documented search. Postgres is where the index-backed ones have room to grow, so design a corpus you expect to rank against Postgres.

## Related reading

- **Search Overview** — the four search mechanisms and which one a configuration reaches.
- **Search Components** — the components that put a search box on a page.
- **Field Types Overview** — `indexed` and the other base properties every field shares.
- **Text Fields** — `rich-text`, `long-text` and the rest of the text family.
- **Table Indexes** — multi-column indexes declared on the table rather than on a field.
