# Signed URLs

> A URL that carries its own authorisation — what the signature binds, which files need one at all, and who may mint one.

A private file cannot go in an image tag, be mailed to a customer, or be handed to a third-party renderer: none of those carry your session cookie. Making the bucket public to solve that trades a scoped problem for an unscoped one.

A signed URL is the middle path. It is an ordinary URL carrying a token that binds **the bucket, the path, the operation and an absolute expiry** into one signature. Change any of those four in the query string and the signature stops matching, so the token grants exactly one file, for one purpose, until one moment, and nothing else.

The signing key is `AUTH_SECRET`, or a value derived from the app's encryption key when you have not set one. Changing either invalidates every outstanding signed URL at once, which is the intended emergency lever.

## Which files need one

Three settings decide, from broadest to narrowest.

| Setting                         | Scope        | Effect                                                          |
| ------------------------------- | ------------ | --------------------------------------------------------------- |
| `STORAGE_DEFAULT_ACCESS=public` | Every file   | Nothing is private, and signing becomes pointless               |
| `STORAGE_PUBLIC_PATHS`          | Key prefixes | A file under a listed prefix is served with no session or token |
| `public: true` on a bucket      | One bucket   | That bucket's files are served with no session or token         |

```bash
STORAGE_DEFAULT_ACCESS=private
STORAGE_PUBLIC_PATHS=assets/,avatars/,logos/
```

A prefix is matched **literally** against the storage key, so one ending in a slash covers what sits under it and nothing else. A wildcard is refused at startup rather than silently never matching: a star in that value is almost always a mistake about the semantics, and failing loudly beats a prefix that quietly protects nothing.

Everything outside those three carve-outs answers `404` to an anonymous request. That is where signing earns its place.

## Minting and using are different routes

| Method | Endpoint                              | Authentication                         |
| ------ | ------------------------------------- | -------------------------------------- |
| `POST` | `/api/buckets/{bucket}/sign`          | A session is required                  |
| `POST` | `/api/buckets/{bucket}/sign/batch`    | A session is required                  |
| `GET`  | `/api/buckets/{bucket}/signed?path=…` | None — the token **is** the credential |
| `PUT`  | `/api/buckets/{bucket}/signed?path=…` | None — the token **is** the credential |

You mint against the signing route with a session, and the resulting URL points at the signed route, which needs nothing. That separation is exactly what makes the URL forwardable.

## Who may mint one

Signing is gated by the bucket's `sign` and `signUpload` permissions.

| Caller                            | Answer                                        |
| --------------------------------- | --------------------------------------------- |
| No session                        | `401`                                         |
| A session whose role matches      | The signed URL                                |
| A session whose role does not     | `404`, so the boundary itself stays invisible |
| An admin                          | Always passes, whatever the permission says   |
| A bucket declaring no permissions | Admin only — the default, and it is strict    |

**`sign: all` does not mean anonymous.** The session check runs first, before any permission is evaluated, so `all` widens signing to every signed-in user rather than to the public.

If you want files reachable with no session at all, that is a public bucket or a public path prefix — not a signing permission. The two look similar in the configuration and do entirely different things.
