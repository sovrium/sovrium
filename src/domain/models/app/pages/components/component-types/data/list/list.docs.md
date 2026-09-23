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

`itemTemplate` takes `title`, `subtitle`, `image`, `badge` and `metadata`, where `metadata` is an array of `{ field, format }` rendered in the item footer.

## Paging is the binding's business, not the display's

Page size comes from `dataSource.limit`: it sets how many records the first page holds, and each press of Load More appends another page of that size.

`loadMore: button` renders the control that does the appending. On a `dataSource.system` binding it appears only if that binding also declares `totalKey` **and** the endpoint answers a number there — without one the reported total is the page's own length, so there is never anything left to load.

`maxItems` caps how many records the list DRAWS. It does not change what is fetched — a page is transport, a cap is display — so a list at its cap hides the Load More control, since anything the next page brought would be cut off on arrival. To fetch fewer records, set `dataSource.limit` instead.

## Three keys are accepted and then ignored

Stated here rather than left to be discovered: `loadMore: infinite`, `highlight` and `divider` have **no effect**. Each decodes cleanly and changes nothing, so a list declaring `loadMore: infinite` pages exactly like one declaring nothing at all.

They are documented because an unread key is the hardest kind of config to debug: it validates, it renders, and the behaviour it names never arrives. If you need infinite scrolling today, `loadMore: button` is what exists.
