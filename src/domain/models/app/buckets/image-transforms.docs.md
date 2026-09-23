# Image Resize & Fit

> Resizing a stored image at request time from query parameters on the ordinary download URL — and why cropping is a `400` rather than a fallback.

There is no separate image service, no build step and no second copy in storage: the original is read, transformed and cached, and it is never modified.

```http
GET /api/buckets/photos/files/{key}?width=400&height=300&fit=inside
```

The same parameters work on a signed URL and on the URL a record's attachment hands you. They apply to images only — a transform parameter on a PDF or a CSV answers `400`.

## Resize

| Parameter | Range     | Default    | Means                    |
| --------- | --------- | ---------- | ------------------------ |
| `width`   | 1 to 2500 | the source | Target width in pixels   |
| `height`  | 1 to 2500 | the source | Target height in pixels  |
| `fit`     | see below | `inside`   | How to reconcile the two |

Give one dimension and the other follows from the aspect ratio. An integer outside the range answers `400`; the ceiling exists because these transforms run synchronously on the request path, and an unbounded dimension is an unbounded amount of work.

**A non-numeric dimension is ignored, not rejected.** A width of `abc` produces the untransformed image rather than an error — only an out-of-range **integer** is a `400`. If you build URLs from user input, validate before you interpolate: a silently ignored parameter is easy to miss in review.

## Fit modes

`fit` decides what happens when the requested box and the source aspect ratio disagree. It only matters when you give both dimensions; one alone is unambiguous.

| Mode     | Behaviour                                                                     |
| -------- | ----------------------------------------------------------------------------- |
| `inside` | Scales to fit within the box, preserving the ratio; the output may be smaller |
| `fill`   | Stretches to the exact box, ignoring the ratio, and distorts                  |

An unrecognised value answers `400`.

`inside` is what you want almost always. Its one surprise: asking for a 200 by 200 box gives a 200 by 50 image when the source is four to one, because fitting inside a box is not the same as filling it. Size your layout for the box rather than for the returned image.

Reach for `fill` essentially never — it is the only mode that distorts, which is why it has to be named explicitly.

## Cropping is not offered

The crop parameter is gone, and with it the three fit modes that crop or pad to reach an exact box. All of them answer `400`.

The image pipeline exposes no crop primitive, so none of the old strategies — centre, entropy, attention, or a focal point — can be honoured.

### Why an error rather than a fallback

Every available substitution changes your images while still answering `200`. Turning an entropy crop into a centre crop reframes them; turning a covering fit into the nearest surviving mode either stretches them or returns different dimensions.

A `400` is something you find once and fix. A silent substitution is something you discover months later, in a catalogue of badly framed thumbnails.

This is also a correction: an unrecognised fit value used to fall back to a covering crop instead of erroring, so a **typo changed your output rather than reporting itself**.

### Migrating

Delete the crop parameter from your URLs and your presets, and replace a covering fit with `inside`, sizing the layout for the box rather than the image. A CSS object-fit rule on the image element reproduces the old framing in the browser, at the cost of transferring the uncropped pixels.
