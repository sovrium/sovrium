# Profile Avatars

> A signed-in user's own profile picture — two endpoints with no user id in either path, and an image URL nothing else may write.

The account is always the caller's, so one user can never write another's avatar.

| Endpoint                     | Behaviour                                                                   |
| ---------------------------- | --------------------------------------------------------------------------- |
| `POST /api/account/avatar`   | Multipart upload under the field name `file`; answers `201` with the URL    |
| `DELETE /api/account/avatar` | Clears the picture and removes the stored object; answers `200`, idempotent |

```bash
curl -X POST https://app.example.com/api/account/avatar \
  -H "Cookie: $SESSION" \
  -F "file=@portrait.png"
```

The URL lands on the user's `image`, which is what the user directory projects and what an account export reports.

## Where the picture is stored

Nothing has to be declared. An app with no buckets at all still accepts a profile picture: the engine keeps one of its own under the same `avatars` name the minted URL carries, and serves it back from there. Profile pictures are a feature the binary provides, so they cannot depend on the host app having configured storage on their behalf.

**The engine-owned location is private, and private is not the same as invisible.** A stored avatar is served to any **signed-in** caller — an avatar only its owner could load is not an avatar, since a member directory and every comment draw it beside a name. An **anonymous** caller gets `404` rather than `403`, so the URL can never be used to work out which accounts carry a picture.

Declare a bucket named `avatars` when you want different rules, and the rules you write are the ones that apply. The engine-owned location is a fallback, never an override, so an app already serving public avatars keeps serving them.

```yaml
buckets:
  - name: avatars
    public: true
    maxFileSize: 2097152
```

`public: true` hands the picture to logged-out visitors too, which is what a public profile page needs. With no declared bucket, or a bucket omitting the cap, the ceiling is 5 MB; over it answers `413`.

## What is accepted

The filename you send is **ignored**, and so is the content type you declare. The bytes are decoded, the real container header is read, and the extension is derived from that.

| Format | Stored as |
| ------ | --------- |
| PNG    | `.png`    |
| JPEG   | `.jpg`    |
| WebP   | `.webp`   |

Anything else — including a file that merely claims to be one of the three — answers `400` and leaves the existing avatar untouched.

Discarding the filename removes a whole class of problem rather than checking for it. The filename is the one part of an upload entirely chosen by the uploader, so path traversal, null bytes and an extension that disagrees with the content stop being checks that could be wrong and become shapes that cannot arrive. Reading the container header rather than the declared type means HTML calling itself an image is refused here, instead of being stored and later served from your own origin.

## The image URL is not writable

`image` cannot be set by hand. Sending one to the update-user endpoint — or to sign-up, or to the admin user endpoints — answers `400`.

Every non-null value is refused, including a well-formed URL pointing at your own avatars bucket. Shape would prove the URL points at this instance; it would not prove the object belongs to the caller, and that is the thing worth proving.

Sending `image: null` is permitted and clears the picture. Omitting the field entirely leaves it alone, so an ordinary name change still works.

## Outcomes

| Outcome                           | Status                     |
| --------------------------------- | -------------------------- |
| Uploaded                          | `201` with the `image` URL |
| Deleted, or already absent        | `200`                      |
| No session                        | `401`                      |
| No `file` field in the body       | `400`                      |
| Not a decodable PNG, JPEG or WebP | `400`                      |
| Over the bucket cap, or over 5 MB | `413`                      |

Erasing an account removes the stored avatar object along with the row.
