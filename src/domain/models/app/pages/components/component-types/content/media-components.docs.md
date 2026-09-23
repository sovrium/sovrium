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

A failed load shows a placeholder. Wrap an `image` in a `link` to make it clickable.

## `icon`

An inline SVG from the Lucide icon set.

| `props` key   | Description                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------- |
| `name`        | Lucide icon name, mapped to the matching SVG. Substitutes `$variable`.                       |
| `size`        | Width and height in pixels. Defaults to 24.                                                  |
| `color`       | SVG stroke colour. Defaults to `currentColor`, so it inherits the surrounding text.          |
| `strokeWidth` | SVG stroke width. Defaults to 1.5.                                                           |
| `className`   | Tailwind classes, appended after the prestyle.                                               |
| `ariaLabel`   | Accessible label — sets `role="img"` and `aria-label`. Without it the icon is `aria-hidden`. |

Icons draw at stroke 1.5 where Lucide's own default is 2. At the size an icon actually renders, a 2px stroke reads heavier than the text beside it and makes the glyph the loudest thing in a row of controls. Set `strokeWidth` yourself and your value wins.

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

## `audio`

An audio player.

| `props` key | Description                                                        |
| ----------- | ------------------------------------------------------------------ |
| `src`       | Audio URL. Required for single-source audio.                       |
| `controls`  | Show playback controls.                                            |
| `autoplay`  | Autoplay on load.                                                  |
| `loop`      | Loop playback.                                                     |
| `sources`   | Several formats with their MIME types, for cross-browser fallback. |

## `iframe`

An embedded external frame.

| `props` key                      | Description                                                           |
| -------------------------------- | --------------------------------------------------------------------- |
| `src`                            | Frame URL. Required.                                                  |
| `title`                          | Accessible title. Required — a frame with no title is unannounceable. |
| `sandbox`                        | Sandbox attribute restricting what the frame may do.                  |
| `allow`                          | Permissions granted to the frame, such as camera or microphone.       |
| `width`, `height`, `aspectRatio` | Responsive sizing.                                                    |

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

The symbol is rendered on the server and ships no JavaScript. It works with scripting disabled and prints from the browser's own print dialog. The SVG always carries a `viewBox`, so it scales cleanly whether or not you set `size`, and its quiet zone is painted rather than left transparent, which keeps it scannable on a dark background.

Give every symbol an `aria-label`. A QR matrix is opaque to a screen reader, so without one there is nothing to announce. Raise `ecc` to `H` when you overlay a logo: the added redundancy is what lets a scanner recover the covered modules.

### Encoding a short link

`link` encodes the short URL, never the destination. A printed code carrying its destination can never be re-pointed, and its scans can never be told apart from clicks. The encoded URL carries a `qr=1` marker, so a scan is recorded as a scan rather than as a click and the two are reported separately.

The slug is not checked against your declared `links[]`. A poster is usually designed before its campaign exists, so referencing a link you have not minted yet is allowed and renders normally.

### Inspecting and troubleshooting

The wrapper element carries the encoded string as `data-qr-value`. Inside the SVG the payload exists only as path geometry, so this attribute is how you confirm what a symbol actually encodes, in view source or in a test.

A payload longer than the largest QR version can hold is not encodable. The page still renders: the symbol is dropped and the wrapper carries `data-qr-error` with the reason.
