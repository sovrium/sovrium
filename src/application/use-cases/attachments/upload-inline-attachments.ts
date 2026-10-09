/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Persisting inline `{ name, content }` attachment payloads out of a record
 * write and replacing them with what the column holds for a stored file.
 *
 * Every attachment column type takes an inline value: the bytes go into the
 * column's bucket, recorded as uploaded by the writer, and the column then
 * holds what its type holds — the storage key on a `single-attachment`
 * column, a list of keys on a `multiple-attachments` one, and the canonical
 * `{ key, name, mimeType, size }` JSONB shape on the `'attachment'` alias.
 * Plain string keys (already-uploaded references) pass through unchanged.
 *
 * `content` must be base64. Text that is not is refused naming the column,
 * before any byte is stored, rather than stored as its UTF-8 bytes: a caller
 * that pasted a file's text where its encoding belongs would otherwise get a
 * different file than the one it meant.
 *
 * An inline value is an upload, so it is held to what an upload to the
 * column's bucket is held to (`checkUploadFile`): a `name` that is one path
 * segment — it becomes the tail of the storage key, and `../` there would name
 * another file's bytes on a local disk — the bucket's size cap and MIME types;
 * and to the column's own `maxFileSize`, `allowedFileTypes` and `maxFiles`,
 * which the key-reading rules cannot see on a value that has no key yet.
 *
 * A failed upload refuses the write. Running it under `Effect.ignore` and
 * returning the metadata object regardless would create the row pointing at a
 * key that was never written: the API would answer success with a
 * `{ key, size }` for bytes that do not exist, and every later read of that
 * record would 404 on a file the API said it had stored. A dangling reference is
 * worse than a refusal, because only the refusal is something the caller can
 * act on.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { resolveUploadBucket } from '@/application/use-cases/buckets/resolve-bucket'
import { checkUploadFile } from '@/application/use-cases/buckets/upload-policy'
import { inferMimeFromKey } from '@/domain/kernel/identity/mime-types'
import {
  attachmentFieldsOf,
  bucketForField,
  isMimeTypeAllowed,
  scopedTable,
  type AttachmentScope,
} from './attachment-fields'
import { AttachmentRuleViolation, storageUnavailable } from './errors'
import type { AttachmentStorageUnavailable } from './errors'

/** Base64 (standard or URL-safe alphabet), padding optional, whitespace ignored. */
const BASE64_TEXT = /^[A-Za-z0-9+/_-]*={0,2}$/

/** Whether `content` is base64 text — the only encoding an inline value may carry. */
const isBase64Content = (content: string): boolean => {
  const compact = content.replace(/\s+/g, '')
  return BASE64_TEXT.test(compact) && compact.length % 4 !== 1
}

/**
 * Recognise the inline-content payload shape (`{ name, content }`, optional
 * `mimeType`). Keys-only references and metadata objects without `content` pass
 * through untouched.
 */
const isInlineAttachmentPayload = (
  value: unknown
): value is {
  readonly name: string
  readonly content: string
  readonly mimeType?: string
} =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as { name?: unknown }).name === 'string' &&
  typeof (value as { content?: unknown }).content === 'string'

/**
 * Upload one inline payload and return the canonical key-plus-metadata shape,
 * attributed to `uploadedById` — the person writing the record.
 */
const uploadInlinePayload = (
  fieldName: string,
  target: { readonly bucket: string; readonly uploadedById: string | undefined },
  payload: {
    readonly name: string
    readonly content: string
    readonly mimeType?: string
  }
): Effect.Effect<
  {
    readonly key: string
    readonly name: string
    readonly mimeType: string
    readonly size: number
  },
  AttachmentStorageUnavailable,
  StorageService
> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    const bytes = Uint8Array.from(Buffer.from(payload.content, 'base64'))
    const mimeType = payload.mimeType ?? inferMimeFromKey(payload.name)
    const key = `${crypto.randomUUID()}-${payload.name}`
    yield* storage
      .upload(key, bytes, mimeType, target)
      .pipe(Effect.mapError(storageUnavailable(fieldName, 'the supplied file could not be stored')))
    return { key, name: payload.name, mimeType, size: bytes.length }
  })

/** The column types an inline value may be written to. */
const INLINE_COLUMN_TYPES: ReadonlySet<string> = new Set([
  'single-attachment',
  'multiple-attachments',
  'attachment',
])

type InlinePayload = {
  readonly name: string
  readonly content: string
  readonly mimeType?: string
}

/** Every inline payload one column value carries (a list for `multiple-attachments`). */
const inlinePayloadsOf = (value: unknown): readonly InlinePayload[] =>
  (Array.isArray(value) ? value : [value]).filter(isInlineAttachmentPayload)

/** The byte length base64 `content` decodes to, read off its text. */
const decodedSize = (content: string): number =>
  Math.floor((content.replace(/\s+/g, '').replace(/=+$/, '').length * 3) / 4)

/** Why one inline payload may not be stored in its column, or `undefined`. */
const payloadRefusal = (
  scope: Readonly<AttachmentScope>,
  fieldName: string,
  payload: InlinePayload
): string | undefined => {
  const bucket = resolveUploadBucket(scope.app, bucketForField(scope, fieldName))
  if (bucket === undefined) return 'the column is bound to no bucket'
  const size = decodedSize(payload.content)
  const type = payload.mimeType ?? inferMimeFromKey(payload.name)
  const upload = checkUploadFile(bucket, { name: payload.name, size, type })
  return upload?.message ?? fieldRuleRefusal(scope, fieldName, { name: payload.name, size })
}

/** Why a file of `name` and `size` breaks the column's own `maxFileSize` or `allowedFileTypes`. */
const fieldRuleRefusal = (
  scope: Readonly<AttachmentScope>,
  fieldName: string,
  file: { readonly name: string; readonly size: number }
): string | undefined => {
  const field = attachmentFieldsOf(scope).find((candidate) => candidate.name === fieldName)
  if (field?.maxFileSize !== undefined && file.size > field.maxFileSize) {
    return `file size ${file.size} bytes exceeds the maximum of ${field.maxFileSize} bytes`
  }
  const allowed = field?.allowedFileTypes ?? []
  return allowed.length > 0 && !isMimeTypeAllowed(inferMimeFromKey(file.name), allowed)
    ? `file type not allowed; allowed file types: ${allowed.join(', ')}`
    : undefined
}

/** Why a column's value may not be stored, or `undefined`: its `maxFiles`, then each payload. */
const columnRefusal = (
  scope: Readonly<AttachmentScope>,
  fieldName: string,
  value: unknown
): string | undefined => {
  const field = attachmentFieldsOf(scope).find((candidate) => candidate.name === fieldName)
  const count = Array.isArray(value) ? value.length : 1
  if (field?.maxFiles !== undefined && count > field.maxFiles) {
    return `too many files; max files allowed: ${field.maxFiles}`
  }
  return inlinePayloadsOf(value)
    .map((payload) => payloadRefusal(scope, fieldName, payload))
    .find((refusal) => refusal !== undefined)
}

/**
 * The value one column holds once its inline payloads are stored: the item
 * itself for anything that is not inline, and for an inline item the key
 * (declared attachment types) or the metadata object (the `'attachment'`
 * alias).
 */
const storeColumnValue = (
  scope: Readonly<AttachmentScope>,
  field: { readonly name: string; readonly type: string },
  value: unknown
): Effect.Effect<unknown, AttachmentStorageUnavailable, StorageService> => {
  const target = { bucket: bucketForField(scope, field.name), uploadedById: scope.writerId }
  const storeItem = (
    item: unknown
  ): Effect.Effect<unknown, AttachmentStorageUnavailable, StorageService> =>
    isInlineAttachmentPayload(item)
      ? uploadInlinePayload(field.name, target, item).pipe(
          Effect.map((meta) => (field.type === 'attachment' ? meta : meta.key))
        )
      : Effect.succeed(item)
  return Array.isArray(value) ? Effect.forEach(value, storeItem) : storeItem(value)
}

/**
 * Persist every inline attachment payload the record write carries, each
 * recorded as uploaded by the scope's `writerId` (the signed-in writer; absent
 * for a visitor who is not signed in) — what erasure finds her files by.
 * Every payload is checked first (its encoding, then the upload rules), so a
 * refusal stores nothing.
 */
export const uploadInlineAttachmentContent = (input: {
  readonly scope: AttachmentScope
  readonly fields: Record<string, unknown>
}): Effect.Effect<
  Record<string, unknown>,
  AttachmentRuleViolation | AttachmentStorageUnavailable,
  StorageService
> =>
  Effect.gen(function* () {
    const { scope, fields } = input
    const columns = (scopedTable(scope)?.fields ?? []).filter(
      (f) => INLINE_COLUMN_TYPES.has(f.type) && inlinePayloadsOf(fields[f.name]).length > 0
    )
    if (columns.length === 0) return fields

    const notBase64 = columns.find((f) =>
      inlinePayloadsOf(fields[f.name]).some((payload) => !isBase64Content(payload.content))
    )
    if (notBase64 !== undefined) {
      return yield* new AttachmentRuleViolation({
        message: `Attachment content for field '${notBase64.name}' must be base64-encoded`,
        field: notBase64.name,
      })
    }
    const refused = columns
      .map((f) => ({ field: f.name, reason: columnRefusal(scope, f.name, fields[f.name]) }))
      .find((verdict) => verdict.reason !== undefined)
    if (refused !== undefined) {
      return yield* new AttachmentRuleViolation({
        message: `Invalid attachment for field '${refused.field}': ${refused.reason}`,
        field: refused.field,
      })
    }

    return yield* Effect.reduce(
      columns,
      () => ({ ...fields }) as Record<string, unknown>,
      (acc, f) =>
        storeColumnValue(scope, f, acc[f.name]).pipe(
          Effect.map((stored) => ({ ...acc, [f.name]: stored }))
        )
    )
  }).pipe(Effect.withSpan('attachments.upload-inline-content'))
