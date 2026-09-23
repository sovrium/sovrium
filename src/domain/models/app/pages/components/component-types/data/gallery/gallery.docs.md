# Galleries

> The `gallery` component — a responsive card grid over records, in a uniform grid, a masonry wall or a carousel.

A gallery draws one card per record. It binds through the shared `dataSource` module and has no `pagination` key of its own: filtering, sorting and paging all belong to the binding.

<!-- sovrium:options type:gallery depth=3 -->

`gridColumns` sets the column count per breakpoint — `{ mobile, sm, md, lg, xl }`, each 1 to 6. `layout` is `grid` for uniform rows, `masonry` for variable heights, or `carousel` for one walkable track.

```yaml
tables:
  - name: products
    fields:
      - { name: name, type: single-line-text }
      - { name: photo, type: single-attachment }
pages:
  - name: Products
    path: /products
    components:
      - type: gallery
        dataSource: { table: products }
        gridColumns: { mobile: 1, md: 2, lg: 3 }
        layout: masonry
        galleryCard:
          coverImage: '$record.photo'
          aspectRatio: '4:3'
          children:
            - { type: text, element: h3, content: '$record.name' }
```

## The card

`galleryCard` is where a card's own shape is declared. `coverImage` is usually a `$record.*` reference and `aspectRatio` takes a ratio such as `4:3`, `16:9` or `1:1`. `children` are the components rendered in the card body, and `hoverOverlay: { children }` renders over the card on hover. `onClick` is the action a click on the card runs.

Because `children` is an ordinary component tree, a card is composed from the same types a page is: a `text` for the title, a `badge` for a status, a `description-list` for a run of facts. `$record.<field>` resolves inside all of them.
