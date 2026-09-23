# Bucket Permissions

> Five operations, one question each — who may upload, download, delete, and mint a signed URL for either direction.

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

| Operation    | Gate           | Governs                       | When omitted                                             |
| ------------ | -------------- | ----------------------------- | -------------------------------------------------------- |
| `upload`     | File routes    | Writing a new file            | A session is required                                    |
| `download`   | File routes    | Reading a file back out       | Served to anyone on a public bucket; otherwise a session |
| `delete`     | File routes    | Removing a file from storage  | A session is required                                    |
| `sign`       | Signing routes | Minting a signed download URL | Admin only                                               |
| `signUpload` | Signing routes | Minting a signed upload URL   | Admin only                                               |

The consequence worth internalising: **signing is admin-only until you say otherwise, while the three file operations are open to any signed-in caller until you say otherwise.** A bucket whose download links a member should be able to hand out needs `sign` written down, because silence there means no. A bucket only an editor should be able to write to needs `upload` written down, because silence there means yes.

Omitting the whole block applies every fallback above at once.

## `public: true` grants reads, never writes

The flag short-circuits the read gate before any permission is consulted, so a declared `download` cannot narrow a public bucket. It confers nothing on `POST` or `DELETE`.

| Request          | Answer on a public bucket            |
| ---------------- | ------------------------------------ |
| Download         | Served, session or not               |
| Upload or delete | Gated exactly as on a private bucket |

One carve-out, and it is bounded on purpose: an app that declares **no `auth` block at all** has no session system to gate against, so a public bucket there — including the implicit `default`, which resolves to public precisely when auth is absent — stays anonymously writable. That is what keeps a file-upload form working on an app with no accounts. A bucket declared without `public: true` stays unwritable there, and the way out of the asymmetry is the same explicit lever an auth-enabled app uses: `upload: all`.

## What each refusal answers

The status code depends on the gate, and never on the permission.

| Request                                   | Answer                                 |
| ----------------------------------------- | -------------------------------------- |
| Download refused, anonymous or wrong role | `404`, never `403`                     |
| Upload or delete, no session              | `401`                                  |
| Upload or delete, session but wrong role  | `404`                                  |
| Signing, no session                       | `401`                                  |
| Signing, session but no matching grant    | `404`, so the boundary stays invisible |

`GET` is the enumeration surface, so it must never distinguish "absent" from "forbidden" — both anonymous and wrong-role reads answer `404`. On the write and signing routes an anonymous caller gets an actionable `401`, which carries no existence signal, while a caller who **is** signed in and still refused drops to `404` rather than confirming the bucket exists.

Upload's `400` and `413` validations — filename, size, MIME type — run **before** the permission gate, so a malformed upload is refused by shape whether or not the caller could have written it.

## Two rules cut across every check

**Admin always passes a role list.** The admin role is admitted on any bucket regardless of what the array names.

**`all` on a signing permission still needs a session.** The signing endpoints refuse an anonymous caller before any permission is evaluated, so `sign: all` widens signing to every **signed-in** user rather than to the public. To serve files with no session at all, make the bucket public or list its prefix as a public path — that is the switch for an anonymous read.

## The implicit `default` bucket inherits your strictest role list

An app that declares buckets still answers on `/api/buckets/default/...`, and storage keys are flat: an object written through one bucket can be named to another. So the implicit bucket adopts, per file operation, the **intersection** of every role array the declared buckets give that operation. A key your declared buckets reserve to `admin` cannot be reached by naming `default` instead.

Only role arrays propagate — `all` is looser than the implicit bucket's own posture and cannot tighten it, and `authenticated` would deny everyone on a no-auth app. Signing permissions never propagate, because an undeclared `sign` is already admin-only and inheriting one could only loosen it.

Declaring `default` in `buckets[]` explicitly overrides all of this: a declared bucket always wins outright.
