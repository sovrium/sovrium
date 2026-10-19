# Media Components

> Media page components — image, icon, video, audio, iframe and qr-code — with their responsive sizing, lazy loading, accessibility attributes and security sandboxing.

Six of the eleven content types carry media rather than prose. All accept the shared `props` bag — where most media attributes live — plus the `visibility` and `responsive` modules, and `$record.*` references resolve inside `props.src`, `props.alt` and the rest.

```yaml
components:
  - type: image
    props: { src: '$record.cover', alt: '$record.title', loading: lazy, objectFit: cover }
  - type: icon
    props: { name: check-circle, size: 20, color: 'var(--color-primary)' }
```

**Four of these types declare no schema options at all.** `icon`, `video`, `audio` and `iframe` are configured entirely through `props`, which is an open bag: the renderer reads the keys, and the schema does not enumerate them. Their tables below are therefore hand-written and describe renderer behaviour rather than a validated shape — an unrecognised key in `props` is passed through as an HTML attribute rather than refused.

## `image`

A responsive image.

<!-- sovrium:options type:image -->

Everything else an image needs rides in `props`: `src` (required, and it substitutes `$record.*`), `alt`, `loading: lazy` to defer until near the viewport, `srcset` and `sizes` for responsive selection, `width` and `height` to reserve space against layout shift, and `objectFit` (`cover`, `contain`, `fill`, `none`) for scaling.

**`loading` defaults by the image's role.** An image with no `props.loading` renders `loading="lazy"`, so it is fetched only as the reader scrolls towards it. The exception is `variant: hero`: the largest image in the first screen is typically the page's Largest Contentful Paint element, and deferring it delays the metric search engines measure (2.5 seconds is the "good" threshold), so a hero renders `loading="eager"` with `fetchpriority="high"` and is fetched first. An explicit `props.loading` always wins — set `eager` on a small logo that must paint at once, or `lazy` on a hero pushed below a long introduction.

Give every image `width` and `height`: the browser then reserves its box before the file arrives and nothing below it moves — layout shift is the second of those metrics. They reach the element exactly as written; none are invented when you leave them out.

`alt` renders empty when it is omitted, which marks the image as decorative to a screen reader. Give every image that carries meaning a real `alt`.

A failed load shows a placeholder. Wrap an `image` in a `link` to make it clickable.

Every variant draws a plain `<img>`, as shadcn/ui's blocks draw a picture: the default with rounded-lg corners, covering its box; `avatar` round; `thumbnail` rounded-md; `hero` rounded-xl. No variant draws a border. Reference: no shadcn counterpart.

## `icon`

An inline SVG from the Lucide icon set.

| `props` key   | Description                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------- |
| `name`        | Lucide icon name, mapped to the matching SVG. Substitutes `$variable`.                       |
| `size`        | Width and height in pixels. Without it the icon draws at 16 pixels.                          |
| `color`       | SVG stroke colour. Defaults to `currentColor`, so it inherits the surrounding text.          |
| `strokeWidth` | SVG stroke width. Defaults to 2.                                                             |
| `className`   | Tailwind classes, appended after the prestyle.                                               |
| `ariaLabel`   | Accessible label — sets `role="img"` and `aria-label`. Without it the icon is `aria-hidden`. |

Icons draw at lucide's own 2-pixel stroke, the weight shadcn/ui's components draw every icon at, so an icon placed on a page matches the icons inside the buttons, menus and inputs around it. Set `strokeWidth` yourself and your value wins. The icon never shrinks when the row it sits in runs short of room. Reference: no shadcn counterpart (shadcn/ui draws its icons with lucide, the same set).

Icons render correctly as children of `button` and `link`, and emit `data-testid="icon-{name}"`.

## `video`

A player for direct files and for YouTube or Vimeo embeds.

| `props` key   | Description                                                                      |
| ------------- | -------------------------------------------------------------------------------- |
| `src`         | Direct video URL, or an embed URL — YouTube and Vimeo auto-convert to an iframe. |
| `poster`      | Preview image shown before playback.                                             |
| `controls`    | Show playback controls.                                                          |
| `autoplay`    | Autoplay on load.                                                                |
| `muted`       | Start muted.                                                                     |
| `loop`        | Loop playback.                                                                   |
| `aspectRatio` | Responsive sizing — `16:9`, `4:3`, or a custom ratio.                            |
| `tracks`      | Subtitle and caption tracks, in VTT format.                                      |
| `start`       | The second playback starts from: a number, or a `$record.<field>`.               |
| `id`          | Names the player for a `seek` action.                                            |

A self-hosted video spans its column with rounded-lg corners on the muted ground, which shows while the poster or first frame loads, in the light and the dark scheme. Reference: no shadcn counterpart.

## `audio`

An audio player.

| `props` key | Description                                                        |
| ----------- | ------------------------------------------------------------------ |
| `src`       | Audio URL. Required for single-source audio.                       |
| `controls`  | Show playback controls.                                            |
| `autoplay`  | Autoplay on load.                                                  |
| `loop`      | Loop playback.                                                     |
| `sources`   | Several formats with their MIME types, for cross-browser fallback. |
| `start`     | The second playback starts from: a number, or a `$record.<field>`. |
| `id`        | Names the player for a `seek` action.                              |

The browser draws its own transport controls; the player spans its column and Sovrium draws no box of its own around them. Reference: no shadcn counterpart.

### Starting at a moment, and moving the player from the page

`start` cues a self-hosted `video` or an `audio` player at that second before the reader presses play; on a YouTube or Vimeo address it is passed through the embed's own address. It is read by Sovrium and never written onto the element.

A `seek` action moves a player to a moment: `{ type: seek, target, time, play }`. `target` is the player's `props.id`, `time` the moment in seconds — a number or a `$record.<field>` of the record the trigger belongs to — and `play`, `true` by default, starts playback from there; `false` only moves the position. A button, a button in each row of a list template, a list item's `onRowClick`, a table row's `onRowClick` and a gallery or board card's `onClick` can run it, so a transcript beside its recording plays the call from the line the reader clicks. A `target` naming no `video` or `audio` on its page is refused at startup, unless it is built from the record (`clip-$record.id`). A player that is not on screen when the action runs, such as one inside a closed dialog, is left alone. Only a player the browser draws can be moved: a YouTube or Vimeo embed cannot.

```yaml
components:
  - type: video
    props: { id: call-player, src: /media/kickoff-call.mp4, controls: true }
  - type: list
    dataSource: { table: segments }
    listDisplay: { itemTemplate: { title: $record.line } }
    onRowClick: { type: seek, target: call-player, time: $record.start }
```

## `iframe`

An embedded external frame.

| `props` key                      | Description                                                           |
| -------------------------------- | --------------------------------------------------------------------- |
| `src`                            | Frame URL. Required.                                                  |
| `title`                          | Accessible title. Required — a frame with no title is unannounceable. |
| `sandbox`                        | Sandbox attribute restricting what the frame may do.                  |
| `allow`                          | Permissions granted to the frame, such as camera or microphone.       |
| `width`, `height`, `aspectRatio` | Responsive sizing.                                                    |

The frame spans its column with rounded-lg corners and a border, on the page background. Reference: no shadcn counterpart.

**Framing a page or a file of the same app.** Every response refuses to be framed by default (`frame-ancestors 'none'`). When `src` is a path of the app itself — it starts with a single `/`, like `/embeds/booking?from=deliveries` or `/mark.svg` — that address answers `frame-ancestors 'self'` instead, so the frame loads. Only addresses an `iframe` of the app's own pages names get this; every other page, including the one holding the frame, keeps refusing. A full URL is treated as another origin and grants nothing here.

## `qr-code`

A scannable QR symbol rendered inline as SVG.

<!-- sovrium:options type:qr-code -->

Encode exactly one payload: `link` for a short-link slug, `value` for any other string. Declaring both, or neither, fails `sovrium validate`. `ecc` defaults to `M` (15% recovery); `props.aria-label` becomes the SVG `<title>`.

```yaml
components:
  - type: qr-code
    link: spring-promo
    size: 240
    ecc: H
    props: { aria-label: 'Spring promo' }
```

The symbol is rendered on the server and ships no JavaScript. It works with scripting disabled and prints from the browser's own print dialog. The SVG always carries a `viewBox`, so it scales cleanly whether or not you set `size`, and its quiet zone is painted rather than left transparent, which keeps it scannable on a dark background. The symbol takes only the room it needs, on a white quiet zone with rounded corners and a faint ring, and that quiet zone stays white in the dark scheme, because a scanner needs dark modules on a light ground. Without `size`, the symbol is drawn 160 pixels wide, and a width class in `props.className` sizes it instead. Reference: no shadcn counterpart.

Inside a record drawer's `children`, or a board or gallery card, `value` may name the record, `value: $record.sku`, and so may the `aria-label`. That symbol is drawn in the browser once the record is known — and, in a drawer, redrawn when it opens on another record — so it needs scripting, unlike a symbol whose value is written out.

Give every symbol an `aria-label`. A QR matrix is opaque to a screen reader, so without one there is nothing to announce. Raise `ecc` to `H` when you overlay a logo: the added redundancy is what lets a scanner recover the covered modules.

### Encoding a short link

`link` encodes the short URL, never the destination. A printed code carrying its destination can never be re-pointed, and its scans can never be told apart from clicks. The encoded URL carries a `qr=1` marker, so a scan is recorded as a scan rather than as a click and the two are reported separately.

The slug is not checked against your declared `links[]`. A poster is usually designed before its campaign exists, so referencing a link you have not minted yet is allowed and renders normally.

### Inspecting and troubleshooting

The wrapper element carries the encoded string as `data-qr-value`. Inside the SVG the payload exists only as path geometry, so this attribute is how you confirm what a symbol actually encodes, in view source or in a test.

A payload longer than the largest QR version can hold is not encodable. The page still renders: the symbol is dropped and the wrapper carries `data-qr-error` with the reason.

## `file-preview`

A stored file drawn inline: a PDF in the browser's own viewer inside a bordered stage, an image with zoom, a sound or a video in the browser's own player, any other type as an outlined item with a file icon, its name and its type, and a Download button.

<!-- sovrium:options type:file-preview -->

Name the file one of two ways, never both: `field`, an attachment field of the bound record (the invoice of this order), or `file`, a fixed `{ bucket, key }` (the handbook every member reads). A field holding several files previews each in its own stage, one after the other, unless `list: none`, which previews the first only. `toolbar` picks the buttons, in order — `download` and `open` by default, `zoom` (the image at full size) and `rotate` (a quarter turn) for images. A PDF opens in the browser's own viewer, and an `audio/*` or `video/*` file plays in the browser's own player, its download still offered; any other type is shown as an outlined item naming the file and its type, with a Download button on the same signed address. The file is served through an address signed for the reader's own session, so a reader who may not read the record or the bucket sees no preview at all. The stage is a region named by the file, an image takes its alternative text from `altField` or else its file name, and a plain link to the file is always present for a reader whose browser cannot show it.

Reference: shadcn/ui Item (the download face), shadcn/ui Button.
