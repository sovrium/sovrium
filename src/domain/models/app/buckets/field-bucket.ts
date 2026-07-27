/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'

const BUCKET_BOUND_FIELD_TYPES: ReadonlySet<string> = new Set([
  'single-attachment',
  'multiple-attachments',
])

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
