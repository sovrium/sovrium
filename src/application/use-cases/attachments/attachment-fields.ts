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

import { DEFAULT_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { resolveFieldBucket } from '@/domain/models/app/buckets/field-bucket'
import type { App } from '@/domain/models/app'

/** Which table, on which app, a write is being validated against. */
export interface AttachmentScope {
  readonly app: App
  readonly tableName: string
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
 * The fallback is `'default'` and deliberately NOT `buckets[0].name` — see
 * `resolveFieldBucket`'s own doc comment for why the read path's and the write
 * path's fallbacks must not be unified.
 */
export const bucketForField = (scope: Readonly<AttachmentScope>, fieldName: string): string =>
  resolveFieldBucket(scope.app, scope.tableName, fieldName) ?? DEFAULT_BUCKET_NAME

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
