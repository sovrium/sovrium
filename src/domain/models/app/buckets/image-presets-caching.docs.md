# Image Presets & Caching

> Giving a recurring transform a name, and making the second request for it cost nothing.

## Named presets

A preset bundles the dimensions, the fit, the quality and the format under one name. It is **operator configuration** rather than app schema, because the right thumbnail size is a property of the deployment rather than of the business domain.

```bash
STORAGE_TRANSFORM_PRESETS='{
  "thumbnail": { "width": 150, "height": 150, "fit": "inside" },
  "preview":   { "width": 600, "quality": 80 },
  "avatar":    { "width": 64, "height": 64, "fit": "inside" }
}'
```

```http
GET /api/buckets/photos/files/{key}?preset=avatar
GET /api/buckets/photos/files/{key}?preset=thumbnail&quality=95
```

| Situation                                | Result                                  |
| ---------------------------------------- | --------------------------------------- |
| A known preset                           | Its fields become the transform         |
| An explicit parameter alongside a preset | The explicit value wins, field by field |
| An unknown preset name                   | `400`                                   |
| A preset requested with none configured  | `400`, saying so                        |

Overrides are **per field** rather than all-or-nothing, so a preset plus a quality keeps the preset's dimensions and changes only the quality.

Names are alphanumeric with single hyphens, which keeps them safe to put in a URL. Malformed JSON, a non-object value, an illegal name, or a preset declaring the withdrawn crop key **fails the server at startup** rather than at the first request: a typo in this variable is found on deploy, not by a user.

The crop key is refused rather than ignored on purpose. An unknown key used to be dropped without comment, so a preset carrying one would have kept booting while quietly no longer cropping.

## Caching

A transform runs once per distinct combination. The result is held in a process-local cache keyed by the storage key, the transform parameters, and the negotiated format together.

| Mechanism        | Behaviour                                                          |
| ---------------- | ------------------------------------------------------------------ |
| `Cache-Control`  | One year, immutable, never revalidated                             |
| `ETag`           | Derived from the source file plus the transform parameters         |
| `If-None-Match`  | A match returns `304`                                              |
| The server cache | In memory, evicting least-recently-used entries when it is full    |
| The cache budget | `STORAGE_TRANSFORM_CACHE_MAX_SIZE`, in megabytes; `256` when unset |
| Invalidation     | Deleting a file evicts every transform derived from its key        |

`STORAGE_TRANSFORM_CACHE_MAX_SIZE` sets the ceiling in megabytes and defaults to 256.

The one-year immutable header is safe **precisely because keys are content-addressed**: a stored key carries a generated identifier, so a replaced file is a new key and a new URL. Nothing is ever served stale under a URL whose content changed, because that situation cannot arise.

## Originals are never touched

| Guarantee                    | Behaviour                                                 |
| ---------------------------- | --------------------------------------------------------- |
| The source bytes             | Byte-identical after any number of transform requests     |
| A request with no parameters | The original, subject only to negotiation                 |
| An explicit origin format    | The original bytes verbatim, negotiation bypassed         |
| Clearing the cache           | Discards derived variants only; originals stay available  |
| A non-image file             | A transform parameter answers `400`; nothing is attempted |

Transforms are derived, disposable and reproducible: the cache can be dropped at any moment and the next request rebuilds it. An admin can do exactly that through the transform-cache endpoint.

Recognised image types are those inferable from the key's extension. SVG passes through rather than being rasterised, and is always served as a download for the reason upload security gives.
