/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Every column type that holds attachment metadata: the two declared types
 * plus the `'attachment'` JSONB alias. The alias is absent from
 * `KNOWN_FIELD_TYPES`, so `sovrium validate` refuses it, but `sovrium start`
 * creates its column and the read path signs whatever `key` it holds, so every
 * attachment gate (upload, reference check, URL signing) must treat it like
 * the other two.
 */
const ATTACHMENT_FIELD_TYPES: ReadonlySet<string> = new Set([
  'attachment',
  'single-attachment',
  'multiple-attachments',
])

/**
 * The attachment column types that store ONE file metadata object rather than
 * a list: `single-attachment` and the `'attachment'` alias. Deliberately
 * narrower than {@link isAttachmentFieldType}: `multiple-attachments` stores an
 * array and must not be coerced to a single value.
 */
const SINGLE_ATTACHMENT_FIELD_TYPES: ReadonlySet<string> = new Set([
  'attachment',
  'single-attachment',
])

/** The field types whose stored value is an account id: the person a read names. */
const USER_REFERENCE_FIELD_TYPES: ReadonlySet<string> = new Set([
  'user',
  'created-by',
  'updated-by',
  'deleted-by',
])

/** Whether `type` is an attachment column type (single, multiple, or the `'attachment'` alias). */
export const isAttachmentFieldType = (type: string): boolean => ATTACHMENT_FIELD_TYPES.has(type)

/** Whether `type` is an attachment column type that stores a single file object. */
export const isSingleAttachmentFieldType = (type: string): boolean =>
  SINGLE_ATTACHMENT_FIELD_TYPES.has(type)

/** Whether `type` stores an account id (`user` and the three authorship types). */
export const isUserReferenceFieldType = (type: string): boolean =>
  USER_REFERENCE_FIELD_TYPES.has(type)
