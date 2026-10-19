/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { AVATAR_BUCKET_NAME } from '@/domain/models/app/auth/avatar-url'
import { SYSTEM_BUCKET_NAME } from './bucket-identity'
import { BUCKET_BOUND_FIELD_TYPES } from './field-bucket'

/** The part of an app the field-bucket rule reads. */
interface FieldBucketScope {
  readonly buckets?: readonly { readonly name: string }[]
  readonly tables?: readonly {
    readonly name: string
    readonly fields: readonly { readonly name: string; readonly type: string }[]
  }[]
}

/**
 * Every attachment field's `bucket` must name a bucket the app can serve: one
 * it declares, the built-in `system`, or `avatars`, which the engine serves on
 * its own when the app declares none. The rule holds whether or not the app
 * declares a `buckets` block — an app declaring none would otherwise accept a
 * name every upload then answers `Bucket not found` for. A field that names no
 * bucket stores into `system` and is not judged here.
 *
 * Returns `true`, or the first refusal, naming the table, the field and the
 * bucket, and listing the declared buckets.
 */
export const validateFieldBucketReferences = (app: FieldBucketScope): true | string => {
  const declared = (app.buckets ?? []).map((bucket) => bucket.name)
  const served = new Set([...declared, SYSTEM_BUCKET_NAME, AVATAR_BUCKET_NAME])
  const refusal = (app.tables ?? [])
    .flatMap((table) =>
      table.fields.map((field) => ({
        table: table.name,
        field: field.name,
        bucket: BUCKET_BOUND_FIELD_TYPES.has(field.type)
          ? (field as { readonly bucket?: unknown }).bucket
          : undefined,
      }))
    )
    .find((ref) => typeof ref.bucket === 'string' && !served.has(ref.bucket))
  return refusal === undefined
    ? true
    : `Table '${refusal.table}' field '${refusal.field}' references undefined bucket '${String(refusal.bucket)}'. Valid buckets: ${declared.join(', ')}`
}
