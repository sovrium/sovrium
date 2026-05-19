/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BucketSchema } from './bucket'


export const BucketsSchema = Schema.Array(BucketSchema).pipe(
  Schema.filter((buckets) => {
    const names = buckets.map((b) => b.name)
    const uniqueNames = new Set(names)
    if (uniqueNames.size !== names.length) {
      const duplicates = names.filter((name, i) => names.indexOf(name) !== i)
      return `Duplicate bucket names: ${duplicates.join(', ')}`
    }

    return undefined
  }),
  Schema.annotations({
    identifier: 'Buckets',
    title: 'Buckets',
    description:
      'Array of named storage buckets. Each bucket has its own permissions, file constraints, and public/private toggle.',
  })
)

export type Buckets = Schema.Schema.Type<typeof BucketsSchema>

export { BucketSchema, BucketNameSchema, type Bucket, type BucketName } from './bucket'
export { BucketPermissionsSchema, type BucketPermissions } from './permissions'
