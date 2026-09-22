/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'

/**
 * Field types that accept a column-level `bucket` binding.
 *
 * The test-only `'attachment'` alias is deliberately absent: it is parsed as
 * `UnknownFieldSchema` and therefore carries no `bucket` property, so it can
 * only ever resolve to its caller's fallback.
 *
 * Exported because a second question needs the same list: `appUsesStorage`
 * asks whether an app can put a byte in storage AT ALL, and one of the three
 * ways it can is a column of one of these types. Two lists that had to agree
 * about which columns are attachments could not be kept in step by review.
 */
export const BUCKET_BOUND_FIELD_TYPES: ReadonlySet<string> = new Set([
  'single-attachment',
  'multiple-attachments',
])

/**
 * Resolve the storage bucket DECLARED on a table column.
 *
 * Returns the column's `bucket` value, or `undefined` when the table/column
 * is unknown, the column is not a bucket-bindable attachment type, or the
 * `bucket` prop was omitted.
 *
 * ── Why this returns `undefined` instead of a fallback ────────────────────
 * The fallback is deliberately the CALLER's choice, and the callers do not
 * agree:
 *
 * - The records read path, the CRUD-form file field and the record-field
 *   renderer fall back to the implicit `'default'` bucket. They are bulk
 *   projections over arbitrary columns, so silently adopting an unrelated
 *   declared bucket would mislabel every unbound attachment.
 * - `resolveFormBucket` (form file uploads) falls back to `buckets[0].name`:
 *   a form knows which form it is serving and can reasonably adopt the app's
 *   only bucket.
 *
 * `[internal ref]` declares a bucket AND leaves the column
 * unbound precisely so an attempt to unify the two fallbacks fails.
 *
 *.
 */
export const resolveFieldBucket = (
  app: Readonly<App>,
  tableName: string,
  fieldName: string
): string | undefined => {
  const table = app.tables?.find((t) => t.name === tableName)
  const field = table?.fields.find((f) => f.name === fieldName)
  if (!field || !BUCKET_BOUND_FIELD_TYPES.has(field.type)) return undefined
  const { bucket } = field as { readonly bucket?: unknown }
  return typeof bucket === 'string' && bucket.length > 0 ? bucket : undefined
}
