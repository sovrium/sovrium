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

`galleryCard` is where a card's own shape is declared. `coverImage` is usually a `$record.*` reference and `aspectRatio` takes a ratio such as `4:3`, `16:9` or `1:1`. `children` are the components rendered in the card body, and `hoverOverlay: { children }` renders over the card on hover. `onClick` takes the two shapes a board card's click takes. `{ type: navigate, path }` makes the card a link to that path, filled from the card's record, so a reader can open it in a new tab. `{ action: openDrawer, component }` opens the card's record in the drawer with that `id` on the same page; that drawer stays closed until a card is clicked. Any other action is refused when the config is decoded. A navigate path — the card's, or a hover-overlay button's — only ever opens a page on this site: a filled path that points to another site or a script draws no link and goes nowhere, as a list item's does. A `coverImage`, or the `src` of an `image` child, naming an attachment field shows the first file it holds that is an image, passing over any document before it. A file that is not an image — a PDF, a Word document — is never drawn: a card whose files are none of them images has no cover, as a card whose field is empty. A file is an image when the type stored with it says so or, with no stored type, when its file name ends in an image extension. One typed as text is drawn only when the filled value is a web address (`http` or `https`, without a user name or password) or a path on this site; any other value, such as a script or an address on another site written without its scheme, shows no image. A cover loads lazily, as the reader scrolls towards it; `galleryCard.loading: eager` fetches the covers with the page, for a gallery that opens the screen.

A card holds record components bound to its record: a `text` for the title, a `badge` for a status, an `avatar` drawn from a name (`label: $record.holder`), an `image` (`src: $record.photo`, an `https://` address or a path), a `qr-code` encoding a value of the record (`value: $record.asset_tag`; `size`, `ecc` and `props.className` mean what they mean on a page `qr-code`). `$record.<field>` resolves inside all of them. A data component — a list, a table, a chart — cannot sit in a card: `sovrium validate` and boot refuse it, naming `galleryCard.children`.

A card child whose `$record.*` names a field its reader may not read is left out of her cards — the whole child, not just its value — and the page does not name the field.
