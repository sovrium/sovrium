# Upload & Batch Signing

> Getting bytes into storage without routing them through the application server, and minting many URLs in one round trip.

## Upload URLs

An upload signed URL is a one-shot write permit for one path. The browser writes directly to it, and your server never touches the bytes.

```http
POST /api/buckets/uploads/sign
Content-Type: application/json
Cookie: <session>

{
  "path": "uploads/user-123/profile-photo.jpg",
  "operation": "upload",
  "expiresIn": 600,
  "contentType": "image/jpeg",
  "maxSize": 5242880
}
```

| Field         | Required | Default                     | Notes                                                                                                   |
| ------------- | -------- | --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `path`        | yes      | —                           | The exact key to write; you choose it                                                                   |
| `operation`   | yes      | —                           | Must be `upload`, since the default is `download`                                                       |
| `expiresIn`   | no       | `3600`                      | 60 to 604800 seconds                                                                                    |
| `contentType` | no       | any type the bucket accepts | Enforced on the write; refused at signing (`400`) when the bucket's `allowedMimeTypes` does not list it |
| `maxSize`     | no       | 10 MB                       | A byte ceiling, enforced on the write; never above the bucket's own cap                                 |

Unlike a download token, an upload token does **not** require the file to exist — that is the point. It requires the opposite: signing for a path that already holds a file is refused with `409`, and no URL is handed out. A signed upload writes a new file; replacing one goes through the upload route, where the file's owner is checked. The `signUpload` permission gates who may mint one, and it defaults to admin-only (the built-in `admin` and the app's highest role).

### The bucket's rules bind the permit

The caller asking for a permit may narrow the bucket's rules, never widen them:

- **Size.** The bound ceiling is the smaller of what was asked (10 MB when nothing is) and the bucket's effective cap — its `maxFileSize`, else `STORAGE_MAX_FILE_SIZE`, else 100 MB. Asking for more than the bucket allows yields a permit for what the bucket allows.
- **Type.** A `contentType` the bucket's `allowedMimeTypes` does not list is refused at signing. A permit signed with no type accepts only the types the bucket lists (any type when it lists none).
- **Uploader.** The file is recorded as uploaded by the person who signed the permit — the write itself carries no session — so it is theirs to delete, and erasure of their account removes it.

### The constraints are signed

The content type and the size ceiling appear in the query string, and both are folded into the signature. Editing either invalidates the token, so a client cannot widen its own permit by rewriting the URL it was given.

| At write time                                                                                  | Result                        |
| ---------------------------------------------------------------------------------------------- | ----------------------------- |
| Within the window, type and size honoured                                                      | `200`                         |
| A content type differing from the bound one, or outside the bucket's types when none was bound | `400`                         |
| A body larger than the bound ceiling                                                           | `413`                         |
| A path that already holds a file                                                               | `409`, and nothing is written |
| Past expiry, or any parameter altered                                                          | `403`                         |
| A download token used for a write                                                              | `403`, an operation mismatch  |
| A path some other bucket owns                                                                  | `404`, and nothing is written |

The stored file lands at **exactly** the path you signed; no prefix is added, unlike a multipart upload. You picked the key, so you also own collisions: two permits signed for the same path before either is used both verify, and the second write is refused with `409` once the first has stored its file.

That holds within one bucket only. A permit minted on one bucket cannot write a key another owns, however wide the signing permission is on the first.

### A write permit is a bigger grant than a read one

Anyone holding the URL can write those bytes until it expires. Ten minutes is generous for a form submission; an hour is already a long time for a permit nobody can revoke.

Always set the content type and the size ceiling explicitly rather than accepting "any type, ten megabytes" — those two are what keep a leaked permit from becoming an arbitrary write.

## Batch signing

One request, up to a hundred URLs. The obvious use is a gallery page where every thumbnail is private.

```http
POST /api/buckets/photos/sign/batch
Content-Type: application/json
Cookie: <session>

{
  "files": [
    { "path": "photo-1.jpg", "expiresIn": 3600 },
    { "path": "photo-2.jpg", "expiresIn": 3600 },
    {
      "path": "uploads/new.jpg",
      "expiresIn": 600,
      "operation": "upload",
      "contentType": "image/jpeg",
      "maxSize": 5242880
    }
  ]
}
```

Each entry carries its own lifetime and its own operation.

Each entry is judged by the same grants as the single form: a download entry needs the bucket's `sign` permission, an upload entry needs `signUpload`. A caller who lacks either is refused the whole request, with `404` when signed in and `401` when anonymous, and gets the same answer whether the named files exist or not. A batch never lets anyone sign more than they could one file at a time.

An upload entry takes the same `contentType` and `maxSize` fields as a single upload request, with the same defaults and the same bucket rules: the size is clamped to the bucket's cap, a type the bucket does not accept fails the whole request with `400`, and an entry whose path already holds a file comes back with `error: 'conflict'` instead of a URL.

A download entry whose file is missing comes back with an error **instead of failing the batch** — a gallery with one dead reference still renders the other ninety-nine.

A few things do fail the whole request, and sign nothing: more than a hundred entries, an entry that names no path (or a path that is not text, answered `400` with `Missing path` as the single form answers it), and any single out-of-range lifetime or size limit. The asymmetry is intentional — a missing file is a data condition you can render around, while a malformed entry is a bug in the caller.
