# Attachment Fields & Storage

> An attachment field stores a reference, not a file — which bucket the bytes land in, what the column actually holds, and why a returned URL is not a durable handle.

```yaml
tables:
  - id: 1
    name: contracts
    fields:
      - id: 1
        name: document
        type: single-attachment
        bucket: documents
        allowedFileTypes: [application/pdf]
        maxFileSize: 10485760
```

## Which bucket

`bucket` names an entry in your buckets array. Omit it and the field writes to the built-in `system` bucket, whose visibility follows whether authentication is configured.

Two layers of limits then apply to the same upload, and **both must pass**.

| Limit          | On the field       | On the bucket                          |
| -------------- | ------------------ | -------------------------------------- |
| Accepted types | `allowedFileTypes` | `allowedMimeTypes`                     |
| Size ceiling   | `maxFileSize`      | `maxFileSize`, then the global ceiling |

Declaring the tighter of the two on the field keeps the intent next to the column it constrains; the bucket limit remains the backstop for every field pointing at it.

## What the column holds

The file reaches storage through the ordinary upload endpoint, which returns a key. **That key** — not the filename, not a URL — is what the column holds.

With `storeMetadata` on, the column instead holds an object carrying the key plus the metadata captured at upload, such as dimensions or duration. Either shape resolves to the same stored object; the difference is only how much you can render without a second request.

### Referencing a file you already uploaded

An attachment value can reference a previously uploaded key only when that key was uploaded into the column's own bucket; inline `{ name, content }` values and multipart form uploads are stored there automatically, and existing rows and seeds are not re-checked.

The writer's role must also be able to download from that bucket. A reference that fails either condition — or names a key storage has never recorded — is refused with a `400`, and the answer is the same in every case, so it never reveals whether a file exists.

An automation's record steps are held to the same rule, and a refused reference fails the step without writing anything. A step running as the person who triggered it (`runAs: triggering-user`) is judged as that person. A step that writes as nobody — a webhook, a schedule, a record event, any run without `runAs` that no one started by hand — may attach only a file an earlier step of the same run stored in the column's bucket, or an inline value. Any key that existed before the run is refused with the same message, whoever triggered the run and whoever stored the file. The run's own files are counted until it pauses: after an approval or a wait, and in an `automation/call` child run, a step acting for nobody can no longer attach a file stored before the pause — store it again after the pause, or run the step as a person. To attach an existing file, run the step as a person (`runAs: triggering-user`, or a run started by hand); it is then judged on that person's download right. An inline value's `content` must be base64: text that is not is refused with a `400` naming the column, and nothing is written. An inline value is an upload, held to what an upload to the column's bucket is held to — its `name` is one file name, with no `/`, `\` or `..`, and its size and type fit the bucket's `maxFileSize` and `allowedMimeTypes` — and to the column's `maxFileSize`, `allowedFileTypes` and `maxFiles`. A value that breaks one is refused with a `400` naming the column. A record step of an automation stores an inline value the same way, and a refused one fails the step.

An update checks only the columns it carries, and it checks them as new references. A client that echoes a whole record back therefore re-submits its attachment values too, and a seeded or legacy key that storage never recorded is refused there. Leave an unchanged attachment column out of the update rather than sending it back.

## What a read returns

An attachment value comes back decorated with a way to actually fetch the file, and which decoration depends on the storage access mode.

```json
{
  "id": 1,
  "fields": {
    "document": {
      "key": "9f3c1e2a-7b44-4d10-9e21-8a6f0c1d2e3b-contract.pdf",
      "signedUrl": "https://app.example.com/api/buckets/documents/signed?path=…&op=download&expires=…&token=…",
      "signedUrlExpiresAt": "2026-04-05T11:00:00Z"
    }
  }
}
```

| Access mode            | Added to the value                              | Lifetime |
| ---------------------- | ----------------------------------------------- | -------- |
| `private`, the default | `signedUrl` and `signedUrlExpiresAt`            | an hour  |
| `public`               | `url`, a plain link with no token and no expiry | forever  |

A bucket counts as public either through its own `public: true` flag or through the operator-global `STORAGE_DEFAULT_ACCESS=public`.

The two are **mutually exclusive by design**: in public mode the signed URL is deliberately absent, so a client can rely on the plain one never carrying a token, and on a signed one always meaning "this expires".

Because the URL is minted per read, a record fetched an hour ago carries a link that has since died. Re-read the record rather than caching the URL — the key is the durable handle, and the URL is not. A page's row template gets the same address from `$record.<attachment>`, minted for each page view.

### The URL is bound to the field's own bucket

The link a read attaches is built against the bucket the column declares, so a field pointing at `documents` returns a URL under `documents`. A column declaring no `bucket` falls back to the built-in `system` bucket — not to the first bucket in your array, which would make the target depend on the order you happened to write them in.

The signature covers that bucket name along with the path, the operation and the expiry, so a URL minted for one bucket cannot be re-pointed at another by editing the query string.

## Images on an attachment

An image attachment's signed URL takes transform parameters appended to it, so one stored original serves every size a page needs.

```text
<signedUrl>&width=150&height=150&fit=inside
```

The token covers the path and the expiry, **not** the transform query, so appending parameters never invalidates it. That is what makes one minted URL usable for a thumbnail and a full-size view at once.

## Deleting

Record deletion drives file deletion. In short: a soft delete keeps the bytes, a purge removes them, a hard delete does not, and replacing or clearing a single-attachment value deletes the file it displaced.
