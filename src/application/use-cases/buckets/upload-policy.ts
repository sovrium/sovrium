/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a bucket will accept, decided before anything is written.
 *
 * Four rules, all pure and all decidable from the request metadata alone:
 * the filename must not name somewhere else, an explicit key must not either,
 * the bytes must fit the smallest configured cap, and the MIME type must be one
 * the bucket declares. Every one of them is answered BEFORE the permission
 * gate, deliberately: an oversized or malformed upload is refused whether or not
 * the caller has a session, so a 413 stays reachable without one.
 *
 * A rejection names a `reason` and carries the message a human reads. It does
 * NOT carry a status: mapping a reason onto 400 or 413 is the HTTP caller's job,
 * and the automation file actions that share these rules have no statuses to map
 * it to.
 */

import {
  isCanonicalStorageKey,
  STORAGE_KEY_MAX_BYTES,
  STORAGE_KEY_SEGMENT_MAX_BYTES,
  STORAGE_KEY_UUID_PREFIX_LENGTH,
} from '@/domain/kernel/identity/storage-key'
import type { Bucket } from '@/domain/models/app/buckets'

/** Why an upload was refused. */
export type UploadRejectionReason =
  'invalid-filename' | 'invalid-path' | 'file-too-large' | 'mime-type-not-allowed'

/** An upload the bucket will not accept, and the message that says why. */
export interface UploadRejection {
  readonly reason: UploadRejectionReason
  readonly message: string
}

/** The upload metadata these rules read — deliberately not a whole `File`. */
export interface UploadCandidate {
  readonly name: string
  readonly size: number
  readonly type: string
}

/** Default 100MB when no env var or bucket-level limit is configured. */
const DEFAULT_MAX_FILE_SIZE = 104_857_600

/**
 * The longest filename a stored key can carry: the `<uuid>-` prefix shares the
 * key's single segment with it, and that segment is capped.
 */
const MAX_FILENAME_BYTES = STORAGE_KEY_SEGMENT_MAX_BYTES - STORAGE_KEY_UUID_PREFIX_LENGTH

const utf8Bytes = (text: string): number => new TextEncoder().encode(text).length

/**
 * The platform spellings a new key is held to. A desktop install on Windows
 * stores files on a Windows disk, where `a:b` and `a.png.` alias other names,
 * so the doors refuse them there, before the adapter would.
 */
const hostKeyPlatform = () => ({ windows: process.platform === 'win32' })

const WINDOWS_SPELLING_MESSAGE =
  'a reserved character (<>:"|?*) or a trailing "." or space is not allowed'

/**
 * Reject a filename that names somewhere other than itself.
 *
 * A filename is a single segment: `/` and `\` are separators, `..` walks up, and
 * a NUL byte truncates the key inside whatever C library eventually sees it. It
 * must also leave room for the `<uuid>-` prefix inside one stored segment.
 */
const checkUploadFilename = (name: string): UploadRejection | undefined => {
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    return {
      reason: 'invalid-filename',
      message: 'Invalid filename: path traversal sequences are not allowed',
    }
  }
  if (name.includes('\x00')) {
    return { reason: 'invalid-filename', message: 'Invalid filename: null bytes are not allowed' }
  }
  if (utf8Bytes(name) > MAX_FILENAME_BYTES) {
    return {
      reason: 'invalid-filename',
      message: `Invalid filename: longer than ${MAX_FILENAME_BYTES} bytes`,
    }
  }
  // Judged as the stored segment `<uuid>-<name>`, so an empty name is still a name.
  if (
    !isCanonicalStorageKey(
      `${'0'.repeat(STORAGE_KEY_UUID_PREFIX_LENGTH)}${name}`,
      hostKeyPlatform()
    )
  ) {
    return { reason: 'invalid-filename', message: `Invalid filename: ${WINDOWS_SPELLING_MESSAGE}` }
  }
  return undefined
}

/**
 * Reject an explicit upload `path` — the storage key a file is stored at,
 * verbatim, with no UUID prefix.
 *
 * Unlike a filename a path MAY contain `/` separators; that is the whole point
 * of the `STORAGE_PUBLIC_PATHS` prefix feature. Traversal, NUL bytes and a
 * leading `/` are still refused, and so is every other spelling a provider
 * would rewrite into a different key — an empty or `.` segment, a trailing `/` —
 * because the owner of a key is looked up by its literal text.
 */
export const checkUploadPath = (path: string): UploadRejection | undefined => {
  if (path.length === 0 || path.startsWith('/')) {
    return { reason: 'invalid-path', message: 'Invalid path: must be a non-empty relative path' }
  }
  if (path.includes('..') || path.includes('\\')) {
    return {
      reason: 'invalid-path',
      message: 'Invalid path: path traversal sequences are not allowed',
    }
  }
  if (path.includes('\x00')) {
    return { reason: 'invalid-path', message: 'Invalid path: null bytes are not allowed' }
  }
  if (utf8Bytes(path) > STORAGE_KEY_MAX_BYTES) {
    return {
      reason: 'invalid-path',
      message: `Invalid path: longer than ${STORAGE_KEY_MAX_BYTES} bytes`,
    }
  }
  if (path.split('/').some((segment) => utf8Bytes(segment) > STORAGE_KEY_SEGMENT_MAX_BYTES)) {
    return {
      reason: 'invalid-path',
      message: `Invalid path: a segment is longer than ${STORAGE_KEY_SEGMENT_MAX_BYTES} bytes`,
    }
  }
  if (!isCanonicalStorageKey(path)) {
    return {
      reason: 'invalid-path',
      message: 'Invalid path: empty or "." segments and a trailing "/" are not allowed',
    }
  }
  if (!isCanonicalStorageKey(path, hostKeyPlatform())) {
    return { reason: 'invalid-path', message: `Invalid path: ${WINDOWS_SPELLING_MESSAGE}` }
  }
  return undefined
}

/** Whether the bucket's `allowedMimeTypes` admits this type. An absent list admits all. */
export const isMimeTypeAllowed = (bucket: Readonly<Bucket>, mimeType: string): boolean => {
  const allowed = bucket.allowedMimeTypes
  if (!allowed || allowed.length === 0) return true
  return allowed.some((entry) =>
    entry.endsWith('/*') ? mimeType.startsWith(entry.slice(0, -1)) : mimeType === entry
  )
}

/**
 * The effective size cap and which tier produced it.
 *
 * A bucket-level limit wins over `STORAGE_MAX_FILE_SIZE`, which wins over the
 * 100MB default. The tier travels with the number so the refusal can name which
 * knob the operator has to turn.
 */
export const resolveMaxFileSize = (
  bucket: Readonly<Bucket>
): { readonly limit: number; readonly tier: 'bucket' | 'global' } | undefined => {
  if (bucket.maxFileSize !== undefined) return { limit: bucket.maxFileSize, tier: 'bucket' }
  const globalMaxEnv = process.env['STORAGE_MAX_FILE_SIZE']
  const globalMax = globalMaxEnv ? parseInt(globalMaxEnv, 10) : DEFAULT_MAX_FILE_SIZE
  if (!Number.isFinite(globalMax) || globalMax <= 0) return undefined
  return { limit: globalMax, tier: 'global' }
}

/**
 * Run every pre-authentication rule against a candidate upload.
 *
 * Order is filename, then size, then MIME type — cheapest and most specific
 * first, so a caller fixing one problem at a time is told about the one they can
 * act on soonest.
 */
export const checkUploadFile = (
  bucket: Readonly<Bucket>,
  file: Readonly<UploadCandidate>
): UploadRejection | undefined => {
  const filenameRejection = checkUploadFilename(file.name)
  if (filenameRejection) return filenameRejection

  // A cap names the LARGEST size accepted, at both tiers: a file of exactly
  // `maxFileSize` or exactly `STORAGE_MAX_FILE_SIZE` is stored.
  const sizeLimit = resolveMaxFileSize(bucket)
  if (sizeLimit && file.size > sizeLimit.limit) {
    return {
      reason: 'file-too-large',
      message: `File size ${file.size} bytes exceeds ${sizeLimit.tier} limit of ${sizeLimit.limit} bytes`,
    }
  }

  if (!isMimeTypeAllowed(bucket, file.type)) {
    return {
      reason: 'mime-type-not-allowed',
      message: `File type '${file.type}' is not allowed. Allowed types: ${(bucket.allowedMimeTypes ?? []).join(', ')}`,
    }
  }

  return undefined
}
