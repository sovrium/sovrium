# Lists

> The `list` component — a vertical run of records drawn from a per-record template, with Load More paging.

A `list` draws one entry per record, from a template you declare. Everything about presentation lives under `listDisplay`; what is fetched, and how much of it, belongs to `dataSource`.

<!-- sovrium:options type:list depth=3 -->

```yaml
tables:
  - name: articles
    fields:
      - { name: title, type: single-line-text }
      - { name: published_at, type: datetime }
pages:
  - name: Articles
    path: /articles
    components:
      - type: list
        dataSource:
          table: articles
          sort: [{ field: published_at, direction: desc }]
          limit: 20
        listDisplay:
          itemTemplate:
            title: '$record.title'
            metadata: [{ field: published_at, format: relative-date }]
          loadMore: button
```

`itemTemplate` takes `title`, `subtitle`, `image`, `badge` and `metadata`, where `metadata` is an array of `{ field, format, options }` rendered in the item footer. A `format` that names a value format — `currency`, `relative-date`, `short-date`, `long-date`, `datetime`, `compact`, `percentage`, `bytes`, `yes-no` and the rest a table column accepts — is applied in the page's language, exactly as it is in a table cell — a `currency` entry in the bound field's own currency, precision and separators; any other word leaves the value as stored. A `currency` entry on a plain number field reads in the code its `options.currency` names — `{ field: budget, format: currency, options: { currency: EUR } }` prints `€48,000.00` — and falls back to US dollars when none is named; a `currency` field keeps its own code whatever `options.currency` says. A slot bound to a `user` field prints the account's name, not its id.

A list takes `onRowClick` like a grid row: `{ action: openDrawer, component: <drawer id> }` opens the clicked item's record in that drawer and writes `?record=<id>&drawer=<drawer id>` into the address; `{ type: navigate, path: /deals?record=$record.id }` follows a path on this site filled with the item's values. A click or Enter on the item runs it. The property is `onRowClick`, as on a grid.

When the binding returns no record, a list says its `listDisplay.emptyMessage` — whether its items come from `itemTemplate` or are drawn from `children` — and never draws its item template with the placeholders unfilled. The empty message accepts a `$t:` key, which prints the active language's text.

## Paging is the binding's business, not the display's

Page size comes from `dataSource.limit`: it sets how many records the first page holds, and each press of Load More appends another page of that size.

`loadMore: button` renders the control that does the appending. On a `dataSource.system` binding it appears only if that binding also declares `totalKey` **and** the endpoint answers a number there — without one the reported total is the page's own length, so there is never anything left to load.

`maxItems` caps how many records the list DRAWS. It does not change what is fetched — a page is transport, a cap is display — so a list at its cap hides the Load More control, since anything the next page brought would be cut off on arrival. To fetch fewer records, set `dataSource.limit` instead.

## Three keys are accepted and then ignored

Stated here rather than left to be discovered: `loadMore: infinite`, `highlight` and `divider` have **no effect**. Each decodes cleanly and changes nothing, so a list declaring `loadMore: infinite` pages exactly like one declaring nothing at all.

They are documented because an unread key is the hardest kind of config to debug: it validates, it renders, and the behaviour it names never arrives. If you need infinite scrolling today, `loadMore: button` is what exists.
