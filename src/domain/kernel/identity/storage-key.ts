/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure helpers for the shared storage-key convention.
 *
 * Sovrium uploads store files under a `<uuid>-<filename>` key (the random
 * per-upload prefix avoids filename collisions while keeping the human-readable
 * filename as a suffix). The infrastructure layer's `buildUploadStorageKey`
 * (`@/infrastructure/storage/upload-key`) produces that key; the download / signed-URL paths strip the prefix again so
 * the original filename surfaces in `Content-Disposition`.
 *
 * This module is the DOMAIN-LAYER home of the prefix-strip so the application
 * layer (e.g. the bucket file-browser list projection) can derive the original
 * filename from a persisted `file_storage_metadata.filename` (which the storage
 * adapters set to the key's basename, i.e. the uuid-prefixed value) WITHOUT
 * reaching into the presentation layer. It mirrors the regex used by the
 * presentation-side `stripUuidPrefix` reader so every consumer agrees on exactly
 * one prefix shape.
 */

/**
 * Width, in characters, of the `<uuid>-` prefix: 36 for the canonical UUID text
 * form (`8-4-4-4-12`, dashes included) plus the separating `-`.
 *
 * Exported because the strip has to happen in SQL as well as here. The bucket
 * file browser orders by the name it DISPLAYS, and what it displays is the
 * stripped value — so `ORDER BY filename` would order four files by their random
 * prefixes. The database therefore reproduces the strip, and takes its width
 * from this constant rather than re-counting it: two spellings of the same rule
 * cannot be checked against each other by eye, so they share the number instead.
 */
export const STORAGE_KEY_UUID_PREFIX_LENGTH = 37

/**
 * Strip the `<uuid>-` prefix a Sovrium upload key carries, returning the
 * original filename. A key with no matching prefix (e.g. a verbatim
 * public-route `explicitPath`) is returned unchanged.
 */
export function stripStorageKeyUuidPrefix(key: string): string {
  const match = key.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i)
  return match?.[1] ?? key
}

/**
 * The longest key, in UTF-8 bytes, a storage provider will hold. 1024 is the
 * object-key ceiling of S3 and its compatibles; a longer key is refused by the
 * store itself, after the request has been accepted.
 */
export const STORAGE_KEY_MAX_BYTES = 1024

/**
 * The longest single `/`-separated segment, in UTF-8 bytes. 255 is the file-name
 * ceiling of every filesystem the local provider writes to (ext4, APFS, NTFS);
 * a longer segment fails the write with `ENAMETOOLONG`.
 */
export const STORAGE_KEY_SEGMENT_MAX_BYTES = 255

const utf8Bytes = (text: string): number => new TextEncoder().encode(text).length

/**
 * Characters Windows refuses in a file name: the reserved punctuation and the
 * control range. `:` is the dangerous one, because NTFS does not always refuse
 * it: it reads `a:b` as the stream `b` of the file `a`.
 */
// eslint-disable-next-line no-control-regex -- the control range is exactly what Windows refuses
const WINDOWS_RESERVED_CHARACTERS = /[<>:"|?*\u0001-\u001f]/

/**
 * Whether a segment is a second spelling of another name on Windows: a reserved
 * character, or a trailing `.` or space, which Windows strips silently (`a.png.`
 * and `a.png ` both open `a.png`).
 */
const isWindowsAliasSegment = (segment: string): boolean =>
  WINDOWS_RESERVED_CHARACTERS.test(segment) || segment.endsWith('.') || segment.endsWith(' ')

/** Which platform-specific spellings a key is also checked against. */
export interface StorageKeyPlatform {
  /** Refuse the spellings Windows would alias or reject: files written on a Windows disk. */
  readonly windows?: boolean
}

/**
 * Whether `key` names exactly one stored object, with nothing for a filesystem
 * or an object-store client to rewrite.
 *
 * Storage keys are flat strings, and ownership is recorded against the literal
 * string. A key that a provider would NORMALISE into a different one — a `.` or
 * `..` segment, an empty segment, a leading or trailing `/`, a `\` that some
 * platforms (and the S3 client) read as a separator — is therefore a second
 * spelling of somebody else's key: the catalog finds no owner for the spelling,
 * and the bytes land on the object it resolves to. A NUL byte truncates the key
 * in whatever C library eventually reads it. Each is refused here, so every
 * spelling a provider accepts is the only spelling of its object.
 *
 * A key longer than {@link STORAGE_KEY_MAX_BYTES}, or with a segment longer than
 * {@link STORAGE_KEY_SEGMENT_MAX_BYTES}, is refused too: no provider can store
 * it, and refusing it here turns the provider's failure into the caller's error.
 *
 * With `{ windows: true }` the Windows-only spellings are refused as well: a
 * reserved character such as `:`, or a segment ending in `.` or a space. They
 * are ordinary characters on every other platform and in object stores.
 *
 * Dots inside a segment (`report..final.pdf`) are ordinary characters.
 */
export const isCanonicalStorageKey = (
  key: string,
  platform: Readonly<StorageKeyPlatform> = {}
): boolean =>
  key !== '' &&
  !key.includes('\\') &&
  !key.includes('\u0000') &&
  utf8Bytes(key) <= STORAGE_KEY_MAX_BYTES &&
  key
    .split('/')
    .every(
      (segment) =>
        segment !== '' &&
        segment !== '.' &&
        segment !== '..' &&
        utf8Bytes(segment) <= STORAGE_KEY_SEGMENT_MAX_BYTES &&
        !(platform.windows === true && isWindowsAliasSegment(segment))
    )

/** How a storage host tells two keys apart. */
export interface StorageKeyComparison {
  /**
   * The host folds letter case: `Brief.txt` and `brief.txt` are one file. True
   * for a local directory on a case-insensitive disk, false for object stores.
   */
  readonly caseInsensitive: boolean
}

/**
 * The form two keys are compared in to decide whether they name one stored
 * object: Unicode NFC always, because a disk that folds normalisation keeps
 * `é` and `e` + U+0301 as one file and one that does not still shows the two as
 * the same name; plus letter case when the host folds it.
 *
 * Lower-casing is `toLowerCase`, never a locale's: `İ` and `ß` fold the same
 * way on every server. A final `ς` is read as `σ`, since `toLowerCase` picks
 * between the two by position and a disk does not.
 *
 * This is a COMPARISON form only. A key is stored and served as written.
 */
export const storageKeyCollisionForm = (
  key: string,
  comparison: Readonly<StorageKeyComparison>
): string => {
  const composed = key.normalize('NFC')
  return comparison.caseInsensitive
    ? composed.toLowerCase().replaceAll('ς', 'σ').normalize('NFC')
    : composed
}

/**
 * Whether `candidate` is a second spelling of the stored key `stored`: a
 * different string that the host would resolve to the same object.
 */
export const isSecondStorageKeySpelling = (
  stored: string,
  candidate: string,
  comparison: Readonly<StorageKeyComparison>
): boolean =>
  stored !== candidate &&
  storageKeyCollisionForm(stored, comparison) === storageKeyCollisionForm(candidate, comparison)
