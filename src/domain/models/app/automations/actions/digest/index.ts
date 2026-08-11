/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DigestCollectActionSchema } from './collect'
import { DigestReleaseActionSchema } from './release'

/**
 * Digest Action — union of all digest operators
 */
export const DigestActionSchema = Schema.Union(
  DigestCollectActionSchema,
  DigestReleaseActionSchema
).pipe(
  Schema.annotations({
    identifier: 'DigestAction',
    title: 'Digest Action',
    description:
      'Digest operations: collect items into buckets and release them for batch processing',
  })
)

/** @public */
export type DigestAction = Schema.Schema.Type<typeof DigestActionSchema>

export * from './collect'
export * from './release'
