/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const DigestCollectActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('digest'),
  operator: Schema.Literal('collect'),
  props: Schema.Struct({
    digestKey: TemplateStringSchema.pipe(
      Schema.annotations({
        description:
          'Digest bucket identifier (supports template variables). Items with the same digestKey are grouped together.',
      })
    ),

    item: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Item to collect into the digest bucket (supports template variables)',
      })
    ),

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

export type DigestCollectAction = Schema.Schema.Type<typeof DigestCollectActionSchema>
