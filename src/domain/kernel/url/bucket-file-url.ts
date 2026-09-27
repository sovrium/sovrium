/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Reading a stored file's address back out of a bucket download URL.
 *
 * Attachment values travel with URLs the platform minted — the public
 * `/api/buckets/<bucket>/files/<key>` form and the HMAC-signed
 * `/api/buckets/<bucket>/signed?path=<key>&…` form — and a client can echo
 * either back into a write. Everything that turns such a URL back into a
 * `{ bucket, key }` pair must read it the SAME way: the attachment-reference
 * confinement inspects what a write names, and every reader downstream (the
 * `ai/transcribe` step, the record purge) acts on what it resolves. A reader
 * that recognises a shape the confinement does not is a door around it, so
 * this is the one parser both sides call — never add a second.
 *
 * Deliberately UNANCHORED: the path is found wherever it sits in the string,
 * with or without an origin in front. For the confinement that is the
 * fail-closed direction (a string that merely resembles a bucket URL is checked
 * rather than waved through); for a reader it is the historical behaviour.
 *
 * Pure: string in, pair out.
 */

/** The bucket a download URL names and the storage key it addresses. */
export interface BucketFileLocation {
  readonly bucket: string
  readonly key: string
}

const FILES_URL = /\/api\/buckets\/([^/?#]+)\/files\/([^?#]+)/i
const SIGNED_URL = /\/api\/buckets\/([^/?#]+)\/signed\?([^#]*)/i

/**
 * `decodeURIComponent` THROWS on a malformed escape (`%E0%A4%A`), and the URL
 * is data a caller shaped — so a segment that does not decode is kept as
 * written rather than turning a lookup into a defect.
 */
const decodeSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * The `{ bucket, key }` a bucket download URL addresses — public `files/` form
 * or signed form (key in its `path` parameter) — or `undefined` when the
 * string is neither, including an external URL, which names no stored file.
 */
export const parseBucketFileUrl = (url: string): BucketFileLocation | undefined => {
  const files = FILES_URL.exec(url)
  if (files !== null) {
    return { bucket: decodeSegment(files[1]!), key: decodeSegment(files[2]!) }
  }
  const signed = SIGNED_URL.exec(url)
  if (signed === null) return undefined
  const key = new URLSearchParams(signed[2]).get('path')
  return key === null || key === '' ? undefined : { bucket: decodeSegment(signed[1]!), key }
}
