# Bucket Permissions

> Five operations, one question each: who may upload, download, delete, and mint a signed URL for either direction.

A bucket's `permissions` block uses the same three-shape value format table permissions use, so nothing new has to be learned to read it.

| Value             | Means                                       |
| ----------------- | ------------------------------------------- |
| `all`             | Everyone, including unauthenticated callers |
| `authenticated`   | Any caller with a session                   |
| `[admin, editor]` | Only the listed roles                       |

```yaml
buckets:
  - name: documents
    maxFileSize: 52428800
    allowedMimeTypes: [application/pdf, text/csv]
    permissions:
      upload: [admin, editor]
      download: authenticated
      sign: authenticated
      signUpload: [admin, editor]
      delete: [admin]
```

## The five operations

<!-- sovrium:options BucketPermissionsSchema -->

Every one of the five is enforced at request time. They split across two gates, and the split is visible only in what an **omitted** entry falls back to.

| Operation    | Gate           | Governs                       | When omitted                                                                                                                  |
| ------------ | -------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `upload`     | File routes    | Writing a new file            | A session is required, an admin's on a public bucket; replacing an existing file at its key: the file's uploader, or an admin |
| `download`   | File routes    | Reading a file back out       | Served to anyone on a public bucket; otherwise a session                                                                      |
| `delete`     | File routes    | Removing a file from storage  | The file's uploader, or an admin                                                                                              |
| `sign`       | Signing routes | Minting a signed download URL | Admin only                                                                                                                    |
| `signUpload` | Signing routes | Minting a signed upload URL   | Admin only                                                                                                                    |

The consequence worth internalising: **signing is admin-only until you say otherwise, while uploading and downloading are open to any signed-in caller until you say otherwise.** A bucket whose download links a member should be able to hand out needs `sign` written down, because silence there means no. A private bucket only an editor should be able to write to needs `upload` written down, because silence there means yes. A public bucket is the other way round: silence there means administrators only, so one your members fill needs `upload` written down.

Removing or replacing a file is judged per file, not per bucket. When `delete` is omitted, a file can be deleted only by the person who uploaded it, or by an admin; when `upload` is omitted, the same rule decides who may upload over an existing file at its key (`path`). A file that records no uploader (one stored before uploaders were recorded, or by a form, an automation or `sovrium seed` with nobody signed in) is an admin's alone. Anyone else is answered exactly as for a key that does not exist (`404`), so the refusal never says whose file sits there. A declared value keeps its declared meaning: `delete: 'authenticated'` lets any signed-in caller delete any file in the bucket, and a role list lets those roles do so. Replacing a file never changes who uploaded it: under a declared `upload`, a caller the grant names may write new bytes at an existing key, but the file stays its first uploader's, so the one who replaced it cannot then delete it under the uploader rule, and its first uploader still can.

> **Upgrading.** Earlier releases let any signed-in caller delete or replace any file in a bucket declaring no `delete` / `upload`. To keep that, declare `delete: 'authenticated'` (and `upload: 'authenticated'` for replacing files).

Omitting the whole block applies every fallback above at once.

## `public: true` grants reads, never writes

The flag short-circuits the read gate before any permission is consulted, so a declared `download` cannot narrow a public bucket. It confers nothing on `POST` or `DELETE`.

| Request  | Answer on a public bucket                |
| -------- | ---------------------------------------- |
| Download | Served, session or not                   |
| Upload   | Admins only, unless `upload` is declared |
| Delete   | Gated exactly as on a private bucket     |

**A public bucket takes uploads from administrators only until you say otherwise**, on every app: a file anyone can download should not be one anyone can place. A member is refused as for a bucket she may not write (`404`), a visitor with `401`, and nothing is stored. A declared `upload` keeps its meaning: `upload: authenticated` lets any signed-in caller fill it, `upload: all` anyone. On an app with **no `auth` block** nobody can sign in, so a public bucket there takes no upload unless it declares `upload: all`. The built-in `system` bucket, which resolves to public precisely when auth is absent, keeps taking anonymous uploads there, which is what keeps a file-upload form working on an app with no accounts. A signed upload URL (`file.signUrl`) writes into the private `system` bucket and is not concerned.

**On an app with no `auth` block, a visitor deletes or replaces only what a bucket opens to everyone.** Nobody can sign in there, so nobody can be a file's uploader: an omitted `delete` admits no visitor, and neither does an omitted `upload` when the key already holds a file. Declare `delete: all` to let visitors remove files, and `upload: all` to let them replace one at its key. The built-in `system` bucket takes a visitor's new file but never lets a visitor delete or replace one: a form attachment is removed with its record, not through the files API. Both refusals answer `404`, and say nothing about whose file sits at the key.

## What each refusal answers

The status code depends on the gate, and never on the permission.

| Request                                   | Answer                                 |
| ----------------------------------------- | -------------------------------------- |
| Download refused, anonymous or wrong role | `404`, never `403`                     |
| Upload or delete, no session              | `401`                                  |
| Upload or delete, session but wrong role  | `404`                                  |
| Delete or replace, app with no `auth`     | `404`                                  |
| Signing, no session                       | `401`                                  |
| Signing, session but no matching grant    | `404`, so the boundary stays invisible |

`GET` is the enumeration surface, so it must never distinguish "absent" from "forbidden": both anonymous and wrong-role reads answer `404`. On the write and signing routes an anonymous caller gets an actionable `401`, which carries no existence signal, while a caller who **is** signed in and still refused drops to `404` rather than confirming the bucket exists.

Upload's `400` and `413` validations (filename, size, MIME type) run **before** the permission gate, so a malformed upload is refused by shape whether or not the caller could have written it.

## Two rules cut across every check

**Admin always passes a role list.** An admin-equivalent role (the built-in `admin` or the app's highest role) is admitted on any bucket regardless of what the array names, and satisfies the admin-only signing default.

**`all` on a signing permission admits anonymous callers.** The signing endpoints evaluate the permission before they require a session, so with `sign: all` (or `signUpload: all`) anyone, signed in or not, can mint a signed URL for the bucket, and the URL then works with no session. Any other value refuses an anonymous caller with `401`. To serve files with no session at all, the plainer switch is still a public bucket or a public path prefix; reach for `sign: all` only when minting URLs for the public is genuinely the intent.

A run someone starts by hand reads a bucket as that person: a bucket whose `download` leaves them out is refused to the run unless the run wrote the file.

## The `system` bucket inherits your strictest role list

An app that declares buckets still answers on `/api/buckets/system/...`, and storage keys are flat: an object written through one bucket can be named to another. So the built-in bucket adopts, per file operation, the **intersection** of every role array the declared buckets give that operation. A key your declared buckets reserve to `admin` cannot be reached by naming `system` instead.

Only role arrays propagate: `all` is looser than the built-in bucket's own posture and cannot tighten it, and `authenticated` would deny everyone on a no-auth app. Signing permissions never propagate, because an undeclared `sign` is already admin-only and inheriting one could only loosen it.

The `system` bucket cannot be declared: the name is reserved, and a `buckets[]` entry called `system` fails validation. To give an attachment field its own rules, point the field's `bucket` at a bucket you declare.
