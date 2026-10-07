/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Reading a table's attachment columns off the running config.
 *
 * Three write-path programs share this: the constraint check, the inline-upload
 * persister, and the `storeMetadata` enricher. All three ask the same two
 * questions — which columns of this table are attachment columns, and which
 * bucket does each one write to — and a second copy of either answer is a
 * second place for the bucket fallback to drift.
 *
 * Everything here is pure: it reads `app.tables[]` and nothing else.
 */

import { parseBucketFileUrl } from '@/domain/kernel/url/bucket-file-url'
import { SYSTEM_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { resolveFieldBucket } from '@/domain/models/app/buckets/field-bucket'
import type { App } from '@/domain/models/app'

/** Which table, on which app, a write is being validated against. */
export interface AttachmentScope {
  readonly app: App
  readonly tableName: string
  /** The signed-in person writing the record — the uploader of any file it stores. */
  readonly writerId?: string
}

/**
 * The subset of an attachment column's declaration these rules read.
 *
 * Structural rather than the full field union: every rule here needs `name`,
 * `type` and the three optional caps, and nothing else, so a field type gaining
 * a property does not reach this file.
 */
export interface AttachmentField {
  readonly name: string
  readonly type: 'single-attachment' | 'multiple-attachments'
  readonly allowedFileTypes?: readonly string[]
  readonly maxFileSize?: number
  readonly maxFiles?: number
}

const isAttachmentField = (f: {
  readonly type: string
}): f is AttachmentField & { readonly type: 'single-attachment' | 'multiple-attachments' } =>
  f.type === 'single-attachment' || f.type === 'multiple-attachments'

/** The table the scope names, or `undefined` when the config declares no such table. */
export const scopedTable = (scope: Readonly<AttachmentScope>) =>
  scope.app.tables?.find((t) => t.name === scope.tableName)

/** Every `single-attachment` / `multiple-attachments` column the table declares. */
export const attachmentFieldsOf = (scope: Readonly<AttachmentScope>): readonly AttachmentField[] =>
  scopedTable(scope)?.fields.filter(isAttachmentField) ?? []

/**
 * The bucket one column's files live in.
 *
 * The fallback is the built-in `system` bucket and deliberately NOT `buckets[0].name` — see
 * `resolveFieldBucket`'s own doc comment for why the read path's and the write
 * path's fallbacks must not be unified.
 */
export const bucketForField = (scope: Readonly<AttachmentScope>, fieldName: string): string =>
  resolveFieldBucket(scope.app, scope.tableName, fieldName) ?? SYSTEM_BUCKET_NAME

/**
 * Extract attachment storage keys from a record's field value, normalising the
 * single- vs multiple-attachment shape into a flat readonly string array.
 */
export const extractAttachmentKeys = (
  field: Readonly<AttachmentField>,
  value: unknown
): readonly string[] => {
  if (field.type === 'multiple-attachments') {
    return Array.isArray(value) ? value.filter((k): k is string => typeof k === 'string') : []
  }
  return typeof value === 'string' ? [value] : []
}

/** Whether a MIME type is permitted by an `allowedFileTypes` list. */
export const isMimeTypeAllowed = (mimeType: string, allowedFileTypes: readonly string[]): boolean =>
  allowedFileTypes.some((allowed) =>
    allowed.endsWith('/*') ? mimeType.startsWith(allowed.slice(0, -1)) : mimeType === allowed
  )

/**
 * Strip the `<uuid>-` prefix the upload path prepends, recovering the original
 * filename. Key format: `<uuid>-<original-filename>`.
 */
export const stripUuidPrefix = (key: string): string =>
  key.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i)?.[1] ?? key

/** The storage key a bucket download URL (public `files/` or signed form) addresses. */
const keyFromBucketUrl = (url: unknown): string | undefined =>
  typeof url === 'string' ? parseBucketFileUrl(url)?.key : undefined

/**
 * Every key an object-shaped attachment item references: its `key`, and the
 * key inside its `url` and its `signedUrl`. ALL of them, not the first found —
 * each reader picks its own (the record enricher reads `key`, the
 * `ai/transcribe` step reads `key` else the first URL, the purge reads `url`),
 * so a value is admissible only when every address it carries is.
 */
const referencedKeysOfObject = (record: Readonly<Record<string, unknown>>): readonly string[] => {
  // An inline `{ name, content }` payload carries its own bytes: it is stored
  // into the column's bucket by the write itself and references nothing.
  if (typeof record['content'] === 'string') return []
  const { key } = record
  return [
    typeof key === 'string' && key.length > 0 ? key : undefined,
    keyFromBucketUrl(record['url']),
    keyFromBucketUrl(record['signedUrl']),
  ].filter((candidate): candidate is string => candidate !== undefined)
}

/** The storage keys one attachment ITEM references (none when it names no stored file). */
const referencedKeys = (item: unknown): readonly string[] => {
  if (typeof item === 'string') {
    return item.length === 0 ? [] : [keyFromBucketUrl(item) ?? item]
  }
  if (typeof item !== 'object' || item === null || Array.isArray(item)) return []
  return referencedKeysOfObject(item as Readonly<Record<string, unknown>>)
}

/**
 * Every EXISTING storage key an attachment value names, de-duplicated.
 *
 * Wider than {@link extractAttachmentKeys}, which reads bare string keys for the
 * type and size caps: a reference can also arrive as an object carrying `key`,
 * a `url` or a `signedUrl` in either bucket download form (read by
 * `parseBucketFileUrl`, the parser every downstream reader shares) — the shapes
 * the read path and the multipart form path produce, and so the shapes a
 * client can echo back. Inline `{ name, content }` payloads are skipped: they
 * carry bytes, not a reference. So is an object whose URL is external: it
 * names no stored file, and no reader resolves one out of it.
 */
export const extractAttachmentReferences = (value: unknown): readonly string[] => [
  ...new Set((Array.isArray(value) ? value : [value]).flatMap(referencedKeys)),
]
