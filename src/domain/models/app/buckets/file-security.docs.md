# Upload Security

> Every upload carries attacker-chosen bytes, an attacker-chosen name and an attacker-chosen type — the order those three are validated in, and what a served file carries back.

Each of the three is validated server-side, in a fixed order, before anything is written.

## Before anything is stored

Each step is total: nothing sanitises and continues.

| Step | Check                                                          | Rejection                         |
| ---- | -------------------------------------------------------------- | --------------------------------- |
| 1    | The filename contains a parent segment, a slash or a backslash | `400`                             |
| 2    | The filename contains a null byte                              | `400`                             |
| 3    | The size exceeds the bucket's cap, or the global one           | `413`                             |
| 4    | The type is not in the bucket's allow-list                     | `400`                             |
| 5    | The bucket's `upload` rule excludes the caller                 | `401` anonymous, `404` wrong-role |
| 6    | Storing the file would exceed the total quota                  | `507`                             |

Steps 1 to 4 run **before** the permission gate, so a malformed or oversized upload is refused by shape whether or not the caller could have written it. `public: true` does not satisfy step 5 on an app that configures auth — it grants reads, never writes.

**The first four run before the auth check.** That ordering is intentional: an oversized or malformed upload is rejected on its own merits, so an unauthenticated client cannot use the auth boundary to learn whether its payload would otherwise have been accepted.

An explicit path follows a slightly different rule set — a slash is allowed, since path prefixes are the whole point, but a leading slash, an empty value, a parent segment, a backslash and a null byte are all refused.

## MIME allow-lists

`allowedMimeTypes` is the bucket's statement about what belongs in it. An entry matches exactly, or as a type-prefix wildcard.

```yaml
buckets:
  - name: avatars
    allowedMimeTypes: [image/*]

  - name: invoices
    allowedMimeTypes: [application/pdf]
```

Omitting the property accepts everything. That is fine for an internal bucket and reckless for one any authenticated user can write to — an allow-list is the cheapest control here, and the only one that expresses **intent** rather than merely blocking an attack.

### The type is the client's claim, not a fact

It comes from the browser's multipart part header, and nothing re-derives it from the bytes. A PDF allow-list stops an accidental upload and a lazy attacker; it does not stop a deliberate one from labelling arbitrary bytes as a PDF.

Pair the allow-list with the response headers below, which are what actually neutralise a mislabelled file.

## What a served file carries

Downloads — direct or through a signed URL — carry three headers whose combined job is to make a stored file **inert** in a browser.

| Header                    | Value                     | Why                                                                |
| ------------------------- | ------------------------- | ------------------------------------------------------------------ |
| `X-Content-Type-Options`  | `nosniff`                 | Stops the browser second-guessing the type and executing the bytes |
| `Content-Security-Policy` | `default-src 'none'`      | Even if rendered, no script, style or network access is permitted  |
| `Content-Disposition`     | `attachment`, or `inline` | Downloads rather than renders, where that matters                  |

The disposition is the one with nuance. Only **raster** images are ever served inline, and then only through the signed-download route where inline display is the point. Everything else is forced to a download, and SVG is explicitly excluded from the inline set: an SVG is a document that can carry a script, so serving one inline on your own origin is stored cross-site scripting.

A non-ASCII filename is emitted in the encoded form, so a header never breaks on a multi-byte name.

## What this does not cover

Two things the platform will not do for you:

- **No virus scanning.** Bytes are stored as received. If your threat model includes malware distribution, put a scanner in front of the upload endpoint or behind an automation.
- **No content-based type detection.** A declared type is trusted for the allow-list decision, and the response headers are what make that acceptable.
