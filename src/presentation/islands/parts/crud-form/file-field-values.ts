/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { FieldDef } from './field-def'

/**
 * A file field's values outside React: validating a pick, uploading it to its
 * bucket, and reading and writing the stored value the form submits.
 */

/**
 * Canonical file metadata stored in the form value for an attachment field.
 * Serialised to JSON and submitted as the field's string value, so the
 * record API writes `{ url, name, size, mimeType }` into the column.
 */
export interface UploadedFile {
  readonly url: string
  readonly name: string
  readonly size: number
  readonly mimeType: string
}

interface BucketUploadResponse {
  readonly success?: boolean
  readonly key?: string
  readonly size?: number
  readonly mimeType?: string
  readonly filename?: string
}

/** An uploaded file paired with the storage key persisted into the record column. */
export interface StoredFile {
  readonly meta: UploadedFile
  readonly key: string
}

/**
 * Reject a file whose MIME type is not in `allowedFileTypes` or whose size
 * exceeds `maxFileSize`. Returns a human-readable error or `undefined`.
 */
function validateFile(file: File, field: FieldDef): string | undefined {
  const types = field.allowedFileTypes
  if (types !== undefined && types.length > 0 && !types.includes(file.type)) {
    return 'File type not allowed. Please choose a valid file.'
  }
  if (field.maxFileSize !== undefined && field.maxFileSize > 0 && file.size > field.maxFileSize) {
    const mb = Math.round(field.maxFileSize / (1024 * 1024))
    return `File size exceeds the maximum of ${mb} MB.`
  }
  return undefined
}

/** Find the first MIME-type / size validation error in a list of selected files. */
function firstFileError(files: readonly File[], field: FieldDef): string | undefined {
  return files.map((file) => validateFile(file, field)).find((error) => error !== undefined)
}

/**
 * The built-in `system` bucket, used when the bound column declares no `bucket`
 * binding. Mirrors the records read path's fallback — deliberately NOT the
 * app's first declared bucket, which is the form-upload path's fallback.
 */
const SYSTEM_BUCKET = 'system'

/** Resolve the bucket a file field uploads to and previews from. */
export function bucketOf(field: FieldDef): string {
  return field.bucket ?? SYSTEM_BUCKET
}

/** Upload a single file to the field's declared storage bucket; returns the stored file. */
export async function uploadFile(file: File, bucket: string): Promise<StoredFile> {
  const body = new FormData()
  body.set('file', file)
  const res = await fetch(`/api/buckets/${bucket}/files`, { method: 'POST', body })
  if (!res.ok) {
    throw new Error(`Upload failed for ${file.name}`)
  }
  const json = (await res.json()) as BucketUploadResponse
  const key = json.key ?? ''
  return {
    key,
    meta: {
      url: `/api/buckets/${bucket}/files/${key}`,
      name: json.filename ?? file.name,
      size: json.size ?? file.size,
      mimeType: json.mimeType ?? file.type,
    },
  }
}

/**
 * Serialise the stored-file list into the form value.
 *
 * `single-attachment` columns are `VARCHAR` and store a single storage key
 * string. `multiple-attachments` columns are `JSONB` and store a JSON array
 * of storage keys. Both shapes are what the record-creation attachment
 * validator (`extractAttachmentKeys`) expects.
 */
export function serializeValue(files: readonly StoredFile[], multiple: boolean): string {
  if (files.length === 0) return ''
  if (multiple) return JSON.stringify(files.map((f) => f.key))
  return files[0]!.key
}

/**
 * Recover the original filename from a storage key (`<uuid>-<filename>`).
 * Returns the key unchanged when it carries no uuid prefix.
 */
function filenameFromKey(key: string): string {
  return (
    key.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i)?.[1] ?? key
  )
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif'])

/** Best-effort MIME inference from a filename extension (used for edit-mode previews). */
function mimeFromName(name: string): string {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  return ext !== undefined && IMAGE_EXTENSIONS.has(ext)
    ? `image/${ext}`
    : 'application/octet-stream'
}

/** Build a StoredFile from a plain storage key string. */
function storedFromKey(key: string, bucket: string): StoredFile {
  const name = filenameFromKey(key)
  return {
    key,
    meta: {
      url: `/api/buckets/${bucket}/files/${key}`,
      name,
      size: 0,
      mimeType: mimeFromName(name),
    },
  }
}

/** Build a StoredFile from a metadata object (edit-mode seeded JSON). */
function storedFromMeta(entry: Record<string, unknown>): StoredFile | undefined {
  const { name } = entry
  if (typeof name !== 'string') return undefined
  const url = typeof entry['url'] === 'string' ? entry['url'] : ''
  return {
    key: url.split('/').at(-1) ?? name,
    meta: {
      url,
      name,
      size: typeof entry['size'] === 'number' ? entry['size'] : 0,
      mimeType: typeof entry['mimeType'] === 'string' ? entry['mimeType'] : mimeFromName(name),
    },
  }
}

/** Parse a JSON string, returning `undefined` when the input is not valid JSON. */
function tryParseJson(value: string): unknown | undefined {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

/**
 * Parse an existing form value (edit mode) back into a stored-file list.
 *
 * Accepts three shapes for backward compatibility:
 *   - a plain storage key string,
 *   - a JSON metadata object (`{ name, url, size, ... }`),
 *   - a JSON array of either of the above.
 */
export function parseInitialValue(value: string, bucket: string): readonly StoredFile[] {
  if (!value.trim()) return []
  const parsed = tryParseJson(value)
  // Not JSON — treat as a single bare storage key.
  if (parsed === undefined) return [storedFromKey(value, bucket)]
  const list = Array.isArray(parsed) ? parsed : [parsed]
  return list.flatMap((entry): readonly StoredFile[] => {
    if (typeof entry === 'string') return [storedFromKey(entry, bucket)]
    if (typeof entry === 'object' && entry !== null) {
      const stored = storedFromMeta(entry as Record<string, unknown>)
      return stored ? [stored] : []
    }
    return []
  })
}

/**
 * Result of validating a fresh file selection: `error` carries a blocking
 * (type / size) error or a non-blocking overflow warning, and `accepted`
 * is the truncated list of files cleared to upload.
 */
interface SelectionPlan {
  readonly error: string | undefined
  readonly accepted: readonly File[]
}

/**
 * Validate and truncate a fresh file selection against the column's
 * MIME-type / size constraints.
 *
 * - A type / size violation rejects the whole selection (`accepted` empty).
 * - A single-file column keeps the first file and warns about the rest.
 */
export function planSelection(
  selected: readonly File[],
  field: FieldDef,
  multiple: boolean,
  existingCount: number
): SelectionPlan {
  const blocking = firstFileError(selected, field)
  if (blocking !== undefined) return { error: blocking, accepted: [] }

  if (multiple) return { error: undefined, accepted: selected }
  const limit = 1

  const overLimit = existingCount + selected.length > limit
  const accepted = selected.slice(0, Math.max(0, limit - existingCount))
  return {
    error: overLimit ? `Too many files — the maximum allowed is ${String(limit)}.` : undefined,
    accepted,
  }
}
