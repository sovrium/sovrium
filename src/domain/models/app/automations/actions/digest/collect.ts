/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/**
 * Digest Collect Action (type: digest, operator: collect)
 *
 * Collect an item into a digest bucket. Items accumulate until the
 * bucket is released (via digest/release). Useful for batching
 * notifications, aggregating events, or building summary digests.
 */
export const DigestCollectActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('digest'),
  operator: Schema.Literal('collect'),
  props: Schema.Struct({
    /** Digest bucket identifier */
    bucket: TemplateStringSchema.pipe(
      Schema.annotations({
        description:
          'Digest bucket identifier (supports template variables). Items with the same bucket are grouped together.',
      })
    ),

    /** Item to add to the digest */
    item: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Item to collect into the digest bucket (supports template variables)',
      })
    ),

    /** Deduplication key to prevent duplicate items */
    deduplicateBy: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description:
            'Template expression for deduplication. Items with the same resolved value are collected only once.',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'DigestCollectAction',
    title: 'Digest Collect Action',
    description: 'Collect an item into a digest bucket for later batch processing',
  })
)

/** @public */
export type DigestCollectAction = Schema.Schema.Type<typeof DigestCollectActionSchema>
