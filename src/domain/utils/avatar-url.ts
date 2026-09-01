/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What an avatar URL is allowed to be.
 *
 * `auth.user.image` is projected by several readers into OTHER users' browsers
 * as an `<img src>`. That makes the column a cross-account rendering surface,
 * not a private profile field, so the only safe value is one this instance
 * itself issued: a root-relative object in a bucket it serves.
 *
 * The single accepted shape is the URL the buckets route already produces —
 * `/api/buckets/{bucket}/files/{key}` (`buckets.ts`, `GET
 * /api/buckets/:bucketName/files/:filename{.+}`). The key may itself contain
 * `/`, which is why the tail is not restricted to a single segment.
 *
 * Everything else is refused, each for its own reason:
 *
 * - **An absolute URL** (`https://evil.example/track.gif`). Rendered into every
 *   other user's browser it is a tracking pixel that leaks their IP and
 *   user-agent to a third party the operator never chose.
 * - **A `javascript:` URI.** Zod's `z.url()` admits it — it is a parseable URL —
 *   so the export contract was never a guard against it.
 * - **A protocol-relative URL** (`//evil.example/x.gif`). It LOOKS root-relative
 *   and is not: the browser resolves it against the page scheme and fetches it
 *   off-origin. This is the bypass a naive `startsWith('/')` check misses; here
 *   the literal `/api/buckets/` prefix excludes it, since the second character
 *   must be `a`.
 * - **Any other same-origin path** (`/api/tables/…`, `/logos/x.svg`). Harmless to
 *   render, but it is not an avatar, and admitting it would let a caller point
 *   the column at any route this instance serves.
 * - **A `..` segment.** Cannot escape the origin, but it can walk out of the
 *   bucket prefix, which would make the shape check describe something other
 *   than the object that is actually fetched.
 *
 * Note what this predicate deliberately does NOT establish: that the object
 * exists, or that the caller owns it. Ownership is unknowable today —
 * `file_storage_metadata.uploaded_by_id` is written by nothing — so a caller
 * handed an issued-SHAPED value could still name somebody else's object. That
 * is why the write guard refuses every non-null client-supplied value outright
 * rather than shape-checking it, and why this predicate's only caller is the
 * READ path. Do not repurpose it into a write-side allow-list.
 */

/**
 * `/api/buckets/{bucket}/files/{key}`.
 *
 * The literal `/api/buckets/` prefix is what rejects a protocol-relative
 * `//host/…`; `\S` forbids whitespace and control characters anywhere in the
 * value, so a newline cannot smuggle a second line past a line-anchored reader.
 */
const ISSUED_AVATAR_URL_PATTERN = /^\/api\/buckets\/[A-Za-z0-9._-]+\/files\/\S+$/

/** `true` when `value` is a bucket-object URL this instance issues. */
export const isIssuedAvatarUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  if (!ISSUED_AVATAR_URL_PATTERN.test(value)) return false
  // A `..` segment would walk out of the bucket prefix the pattern just
  // matched, making the check describe a different object than the one fetched.
  return !value.split('/').includes('..')
}

/**
 * The bucket an avatar object lives in.
 *
 * An avatar is rendered into every other user's browser, so it has to sit
 * somewhere the readers can actually fetch it from — which is why the upload
 * route requires the app to declare a bucket by this name rather than inventing
 * one. Storage keys are FLAT (they carry no bucket), so this name selects the
 * permission row that gates the download, not a physical location.
 */
export const AVATAR_BUCKET_NAME = 'avatars'

/**
 * The URL for a stored avatar object — the one value the write guard's
 * counterpart, {@link isIssuedAvatarUrl}, is meant to accept.
 *
 * This is the ONLY place an avatar URL is minted. The guard refuses every
 * client-supplied value outright, so "the server issued this" is a fact that
 * exists precisely because this function is unreachable from a request body.
 */
export const buildIssuedAvatarUrl = (key: string): string =>
  `/api/buckets/${AVATAR_BUCKET_NAME}/files/${key}`

/**
 * The storage key inside an issued avatar URL, or `undefined` when the value is
 * not one this instance issued.
 *
 * The inverse of {@link buildIssuedAvatarUrl}, and deliberately gated on
 * {@link isIssuedAvatarUrl} rather than on a bare `split`: the two callers that
 * need it (clearing an avatar, and erasing an account) turn the result into a
 * `StorageService.delete`, so a value that merely LOOKS path-shaped must not be
 * allowed to name an object. A legacy row holding `https://evil.example/x.gif`
 * yields `undefined` and deletes nothing, which is the correct outcome: there is
 * no local object to remove.
 */
export const avatarStorageKeyFromUrl = (value: unknown): string | undefined => {
  if (!isIssuedAvatarUrl(value)) return undefined
  const marker = '/files/'
  const at = value.indexOf(marker)
  // `isIssuedAvatarUrl` has already established a non-empty tail after the
  // marker, so this slice is always a real key.
  return value.slice(at + marker.length)
}
