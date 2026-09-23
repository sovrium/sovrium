# File Operations

> The three endpoints every bucket exposes — and the ownership record that decides which bucket may read, write or delete a given key.

The bucket segment is a name from your `buckets` array, or `default` for the implicit bucket.

| Method   | Endpoint                            | Result                                          |
| -------- | ----------------------------------- | ----------------------------------------------- |
| `POST`   | `/api/buckets/{bucket}/files`       | `201` with the generated storage key            |
| `GET`    | `/api/buckets/{bucket}/files/{key}` | `200` with the bytes and a derived content type |
| `DELETE` | `/api/buckets/{bucket}/files/{key}` | `204`, with no body                             |

An unknown bucket name answers `404` on all three, before anything else is read.

## Upload

Send the file as multipart form data under the field name `file`.

```bash
curl -X POST https://app.example.com/api/buckets/documents/files \
  -H "Cookie: $SESSION" \
  -F "file=@report.pdf"
```

| Outcome                                       | Status |
| --------------------------------------------- | ------ |
| Accepted                                      | `201`  |
| No `file` field in the body                   | `400`  |
| An unsafe filename, or a type the bucket bars | `400`  |
| An explicit path at a key another bucket owns | `404`  |
| Over the bucket or global size limit          | `413`  |
| Over the total-storage quota                  | `507`  |
| No session where the bucket requires one      | `401`  |
| A session whose role the bucket excludes      | `404`  |

**The key is not the filename.** Each upload is stored at a generated identifier followed by the original name, so two uploads of the same file never collide and no key is guessable. The original name is recovered from the suffix when the file is served, which is why a download still arrives correctly named.

Persist the returned key. It is the only handle to the file.

### Storing at an explicit path

An optional `path` field stores the file at that exact key instead, with no generated prefix — which is how a file lands under a prefix an operator has marked public.

```bash
curl -X POST https://app.example.com/api/buckets/default/files \
  -F "file=@logo.png" -F "path=public/logo.png"
```

The path must be relative, non-empty, and free of parent-directory segments, backslashes and null bytes. Because you chose the key, you also own collisions — but only within one bucket.

## Download

Every response carries a disposition header, a no-sniff header and a blocking content-security policy.

| Outcome                                        | Status                                        |
| ---------------------------------------------- | --------------------------------------------- |
| The file exists and the caller may read it     | `200` with the bytes                          |
| An unknown key                                 | `404`                                         |
| A key stored under a different bucket, or none | `404`                                         |
| A private bucket, no session and no signed URL | `404` — never `403`, so keys stay unguessable |

An image key accepts transform parameters on this same URL; anything else answers `400` if you try.

## Delete

Success is `204`. An unknown key, a key belonging to another bucket, and a key with no recorded owner all answer `404`, and nothing is deleted.

Deleting also evicts every cached image transform derived from that key, so a stale thumbnail cannot outlive its original.

Deleting a file directly does **not** clear a table record pointing at it. Removing a record's attachment is a separate path.

## Bucket binding

Storage keys are flat. The bucket name in a URL is not a folder and not a path prefix: every bucket addresses one keyspace, and each stored object **records which bucket it was uploaded to**.

That record is what download, delete and every write check. A request naming one bucket for a key uploaded to another is refused, as is a request for an object whose owning bucket is not recorded at all. Both answer `404` — the same as an unknown key, so the refusal reveals nothing about what exists.

### A key belongs to the bucket that created it

Writing is not exempt, and this is the half that matters most. An upload aimed at a key some other bucket already owns does not replace its bytes and does not re-file it under yours: it is refused, and nothing is written.

| The key today        | Written through           | Result                                                    |
| -------------------- | ------------------------- | --------------------------------------------------------- |
| Nothing stored there | Any bucket                | Created, and owned by that bucket from now on             |
| Owned by `invoices`  | `invoices`                | An ordinary re-upload; the bytes are replaced             |
| Owned by `invoices`  | `uploads`                 | `404`, and nothing is written                             |
| Owned by `invoices`  | An automation file action | `404`, and nothing is written                             |
| Stored with no owner | Any named bucket          | `404`, and nothing is written                             |
| Stored with no owner | An automation file action | Written — an unrecorded owner and an unnamed writer agree |

Automation file actions address storage keys directly and name no bucket, which is why they sit in their own rows: an unnamed writer cannot claim a key a bucket owns, and clearing an owner is itself a move — it would leave an object unreadable through every bucket.

Nothing here changes an ordinary re-upload. Replacing your own file, through the bucket you uploaded it to, works exactly as before.

### Upgrading an existing install

Objects stored before this behaviour shipped carry no recorded bucket. On the first boot after the upgrade, Sovrium recovers the bucket for everything the configuration can still account for — the attachment fields declared on tables, and profile images — and logs how many objects it attributed. It runs once, in the background, after the server is already accepting requests, and retries on the next boot if it fails.

Whatever it cannot attribute stays unreachable and answers `404`: objects written straight into the store out of band, orphans whose record was deleted, files referenced only from rich-text content, and form uploads that never landed on a table column.

That is deliberate — an object with no known owner must not be served through a bucket that is merely guessing — but for anyone self-hosting who has ever written objects outside the upload endpoint, it is a **change of behaviour on upgrade** rather than a no-op.

Recovering such an object means **re-uploading it under a new key**. Uploading to the key it already occupies will not repair it: an unattributed object disagrees with every bucket that names itself, so that write is refused like any other cross-bucket write.
