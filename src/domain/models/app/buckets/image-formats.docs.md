# Image Format & Quality

> Transcoding on the same download URL — the four format values, what happens when you name none, and why AVIF is not on the list.

A stored JPEG does not have to leave as a JPEG. By default the server transcodes on its own: a modern browser gets WebP from a PNG original without anyone asking.

## Naming a format

```http
GET /api/buckets/photos/files/{key}?format=webp
```

| Value    | Output     | Reach for it when                                   |
| -------- | ---------- | --------------------------------------------------- |
| `webp`   | WebP       | You want strong compression, and today that is safe |
| `jpeg`   | JPEG       | Nothing may be assumed about the client             |
| `png`    | PNG        | You need transparency or lossless output            |
| `origin` | the source | You are opting out of transcoding for this request  |

The response content type always reflects what was actually produced. An unrecognised value answers `400`.

### AVIF is not available

The image pipeline runs on the runtime's own encoders, and those carry **no AV1 encoder on Linux** — the platform the binary and the container image run on. An AVIF option would therefore have worked on some machines and failed on others, so asking for it answers `400` like any other unsupported value.

WebP is the modern format on offer: it compresses nearly as well, keeps transparency, and every browser released since 2020 reads it.

## Automatic negotiation

Omit the format and the server reads the request's `Accept` header.

| The header contains | Output                        |
| ------------------- | ----------------------------- |
| `image/webp`        | WebP                          |
| Anything else       | The original bytes, untouched |

That is why an ordinary image tag with no query string still gets a modern format in a modern browser and the untouched original in an old one — no picture element, no source-set juggling, and no server-side user-agent sniffing.

`format=origin` bypasses negotiation deliberately: use it when a downstream consumer needs the exact stored bytes, or when you are debugging what was actually uploaded.

### Two pipelines, two rules

The automation's image-transform action encodes to WebP when it converts and names no output format, and a plain resize there keeps the source format.

**This route ignores both rules.** It negotiates from the header and honours an explicit format, and nothing else. There is no environment variable that changes either one.

## Quality

| Behaviour                         | Detail                       |
| --------------------------------- | ---------------------------- |
| Accepted range                    | An integer, 1 to 100         |
| Default                           | `80` when omitted            |
| Applies to                        | Lossy output — JPEG and WebP |
| Ignored for                       | PNG, which is lossless       |
| Outside the range, or non-integer | `400`                        |

Eighty is not a placeholder. It is close to the point where further quality stops being visible and starts only being bytes: raising it to 95 can double the payload for a difference most viewers will not see on most images.

The pairing worth remembering is a small width with a low quality. A hundred-pixel thumbnail at quality 30 is a fraction of a full-quality one and looks identical at that size, because compression artefacts are themselves scaled away. Reserve high quality for images that will be viewed large.

## Three defaults that cover almost everything

- **A content image in a page** — name no format at all, and let negotiation do it.
- **A thumbnail or an avatar** — a width and a low quality. The size does the work; the quality is nearly free to lower.
- **A download somebody asked for** — `format=origin`. Somebody clicking "download original" means it.
