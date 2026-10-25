# Images

Images are usually the heaviest bytes on a page. Sovrium stores the original untouched and derives every variant from its URL: the format, the size and the quality are request parameters, and the result is cached. Manual: `sovrium docs images/image-formats`, `sovrium docs images/image-transforms`, `sovrium docs images/image-presets-caching`, `sovrium docs components/media-components`.

## Contents

- [Format: let negotiation do it](#format-let-negotiation-do-it)
- [Size and quality](#size-and-quality)
- [Presets](#presets)
- [The transform cache](#the-transform-cache)
- [Loading and dimensions on the page](#loading-and-dimensions-on-the-page)
- [What is not an image transform](#what-is-not-an-image-transform)

## Format: let negotiation do it

| Request                                             | Output                                 |
| --------------------------------------------------- | -------------------------------------- |
| No `format`, browser sends `image/webp` in `Accept` | WebP                                   |
| No `format`, any other `Accept`                     | The original bytes                     |
| `?format=webp`, `jpeg` or `png`                     | That format                            |
| `?format=origin`                                    | The stored bytes, negotiation bypassed |
| `?format=avif`, or any unknown value                | `400`                                  |

- **Name no format for a content image.** An ordinary image tag already gets WebP in a modern browser and the original in an old one, with no picture element and no user-agent sniffing. [S9]
- **AVIF is refused** because the runtime the binary and the container run on has no AV1 encoder on Linux; an option that worked only on some hosts would not be one. Committed static assets in your public directory are served as they are, whatever their format.
- `format=origin` is for a download somebody asked for, or for checking what was uploaded.
- An automation's image action has its own rules (it encodes to WebP when it converts with no format named); this route ignores them.

## Size and quality

```http
GET /api/buckets/photos/files/{key}?width=400
GET /api/buckets/photos/files/{key}?width=120&quality=40
```

- `width` and `height` resize; give one and the other follows the aspect ratio. `fit=inside` (the default) fits within the box and may return a smaller image; `fill` distorts and is almost never right.
- Request the size the layout draws, not the original's: a thumbnail served at full size is the most common avoidable weight.
- `quality` applies to JPEG and WebP and is ignored for PNG. A small image at a low quality looks the same at that size, because the artefacts are scaled away; keep high quality for images viewed large. The range and the default: the image-formats article.
- An out-of-range integer answers `400`; a non-numeric dimension is ignored and returns the untransformed image — validate any dimension built from user input.
- A source whose header declares a huge pixel count is refused before decoding (`422`), and the original still downloads.

## Presets

The operator can name transforms once in `STORAGE_TRANSFORM_PRESETS` (JSON in the environment, never the app config), then pages request `?preset=thumbnail`. An explicit parameter beside a preset wins field by field. An unknown preset answers `400`, and a malformed variable stops the server at startup. Read its shape with `sovrium docs env STORAGE_TRANSFORM_PRESETS`.

## The transform cache

- A transform runs once per combination of key, parameters and negotiated format, then is held in a process-local cache that evicts the least recently used entries. Its budget is an operator variable named in the presets article.
- Responses carry a long `immutable` `Cache-Control` and an `ETag`; a matching `If-None-Match` answers `304`. That is safe because storage keys are content-addressed: a replaced file is a new key and a new URL.
- Deleting a file evicts its variants; clearing the cache drops derived variants only, never an original.

## Loading and dimensions on the page

On an `image` component:

| Prop              | Rule                                                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `loading`         | Omitted: `lazy`. `variant: hero` omitted: `eager` with `fetchpriority="high"`. An explicit value always wins — `lazy` on a hero pushed below the fold, `eager` on a small logo that must paint at once |
| `width`, `height` | Always set: the browser reserves the box and nothing below it moves. They are written as attributes, so a width class still sizes the image                                                            |
| `srcset`, `sizes` | Let the browser pick the file for the slot; point the candidates at `?width=` variants                                                                                                                 |
| `objectFit`       | How the file fills the box (`cover`, `contain`)                                                                                                                                                        |

- Exactly one image per page is eager: the largest one in the first screen. Every other image is lazy. [S6][S8]
- Check the rendered `<img>` with `curl` or the browser, not the config: an explicit `loading` overrides the defaults.
- The thresholds those choices serve (LCP, CLS) and the share-image rules are `sovrium-seo-geo`.

## What is not an image transform

- **The logo** in `design.logo` is served as it is and never re-encoded; prefer SVG.
- **SVG** in a bucket passes through, never rasterised, and is served as a download.
- **Committed assets** in the public directory are files on disk, served as committed; compress them before committing.
