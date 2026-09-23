# Download URLs

> Read access to exactly one stored path until a moment you choose — minted with a session, used without one.

```http
POST /api/buckets/documents/sign
Content-Type: application/json
Cookie: <session>

{
  "path": "9f3c1e2a-7b44-4d10-9e21-8a6f0c1d2e3b-contract.pdf",
  "expiresIn": 3600
}
```

The response carries the signed URL, its expiry and the operation. Hand the URL to a browser, an email template or a document renderer — it needs nothing else.

## The request

| Field       | Required | Default    | Notes                                               |
| ----------- | -------- | ---------- | --------------------------------------------------- |
| `path`      | yes      | —          | The storage key, exactly as the upload returned it  |
| `expiresIn` | no       | `3600`     | Lifetime in seconds, from 60 to 604800 — seven days |
| `operation` | no       | `download` | `download` or `upload`                              |

## Outcomes

| Situation                                | Result                                             |
| ---------------------------------------- | -------------------------------------------------- |
| A valid request                          | `200` with the URL and its expiry                  |
| An out-of-range `expiresIn`              | `400`                                              |
| A missing or empty path                  | `400`                                              |
| No file at that path                     | `404` — a download token must reference real bytes |
| No session                               | `401`                                              |
| A session lacking the signing permission | `404`                                              |
| An unknown bucket                        | `404`                                              |

Note the existence check. Unlike upload signing, download signing refuses to mint a token for a path holding nothing — so a signed URL you are holding is a URL that resolved at least once.

## Using it, and losing it

The URL resolves against the signed route, and three things can go wrong there.

| At use time                                    | Result                       |
| ---------------------------------------------- | ---------------------------- |
| Within the window, signature intact            | `200` with the bytes         |
| Past the expiry                                | `403`                        |
| Any query parameter altered                    | `403`, a signature mismatch  |
| An upload token used for a read                | `403`, an operation mismatch |
| A valid token whose file was deleted meanwhile | `404`                        |

Tokens are compared in constant time, so a near-miss leaks nothing through response timing. The `403` for expiry and the `403` for tampering are deliberately the same answer.

### Choose the shortest window that works

A signed URL **cannot be revoked individually**. Once minted it is valid until it expires, whatever happens to the user's session, role or account in the meantime.

Sixty seconds for a redirect, an hour for an email link, and seven days only for something genuinely long-lived. The one global revocation is changing the signing secret, which invalidates every outstanding URL at once.

## Transforms on a signed URL

An image signed URL accepts transform parameters appended to it. The token covers the path, the operation and the expiry — **not** the transform query — so one signed URL serves any size.

```text
<signedUrl>&width=200
```

A raster image arrives with an inline disposition on this route, so it renders directly in an image tag. An SVG does not: it is forced to a download, because an inline SVG on your own origin can execute script.
