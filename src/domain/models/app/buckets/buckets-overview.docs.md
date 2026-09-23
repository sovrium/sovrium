# Buckets Overview

> A named container for uploaded files, with its own size limit, accepted types and visibility — and the line between what the app declares and what the operator decides.

Tables write into buckets through attachment fields, forms accept uploads into them, and the API exposes upload, download, signed-URL and image-transform endpoints per bucket.

Two concerns are deliberately kept apart:

- **Where the bytes live** — the storage backend — is an operator concern set with environment variables, and never appears in the app schema.
- **How files are organised** — the buckets — is application configuration, declared in the top-level `buckets` array.

```yaml
buckets:
  - name: avatars
    public: true
    maxFileSize: 2097152
    allowedMimeTypes: [image/jpeg, image/png, image/webp]
    permissions:
      upload: authenticated
      download: all
      delete: [admin]
```

## Properties

<!-- sovrium:options BucketSchema depth=1 -->

`name` is lowercase letters, digits and hyphens, starting with a letter, up to 63 characters. The ceiling and the leading-letter rule come from object-store prefix compatibility and are enforced offline, so a capitalised or digit-leading name fails validation — as does a duplicate anywhere in the array.

A name is **not a path prefix**. It is the recorded owner of every key uploaded through it, and no other bucket may write those keys.

Omitting `allowedMimeTypes` accepts every type; a wildcard such as `image/*` works. `maxFileSize` overrides the global ceiling for this bucket alone.

## Public or private

| Visibility                   | Behaviour                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `public: true`               | Downloads are served with no session and no token                                 |
| `public: false`, the default | A download needs a session or a valid signed URL; an anonymous request gets `404` |

The `404` is deliberate. A `403` would confirm a file exists at a guessed key, so a private bucket answers as though the path were meaningless.

An operator can also mark path prefixes public across every bucket, independently of what any bucket declares.

## The implicit `default` bucket follows your auth setup

With no `buckets` array at all, `/api/buckets/default/...` is still served. That implicit bucket is **private when authentication is configured** and **public when it is not**: an app with no session system has nothing to gate on, so an anonymous form upload keeps working.

Declare the bucket explicitly the moment you want a different answer — the implicit one is a convenience, not a policy.

## Two buckets, one backend

```yaml
buckets:
  - name: avatars
    public: true
    maxFileSize: 2097152
    allowedMimeTypes: [image/*]
    permissions:
      upload: authenticated
      download: all
      delete: [admin]

  - name: documents
    maxFileSize: 52428800
    allowedMimeTypes: [application/pdf]
    permissions:
      upload: [admin, editor]
      download: authenticated
      sign: authenticated
      signUpload: [admin, editor]
      delete: [admin]
```

Nothing is shared between the two but the backend. The first accepts any image up to 2 MB from any signed-in user and serves it to the world; the second accepts PDFs up to 50 MB from two roles and hands them out only through a session or a signed URL.
