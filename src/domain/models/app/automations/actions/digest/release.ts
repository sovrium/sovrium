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
 * Digest Release Action (type: digest, operator: release)
 *
 * Release all collected items from a digest bucket. Returns the
 * accumulated items as the step output and empties the bucket.
 * Supports sorting and limiting the released items.
 */
export const DigestReleaseActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('digest'),
  operator: Schema.Literal('release'),
  props: Schema.Struct({
    /** Digest bucket identifier to release */
    bucket: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Digest bucket identifier to release (supports template variables)',
      })
    ),

    /** Sort configuration for released items */
    sort: Schema.optional(
      Schema.Struct({
        /** Field to sort by */
        field: TemplateStringSchema.pipe(
          Schema.annotations({
            description: 'Field name to sort by (supports template variables)',
          })
        ),

        /** Sort direction */
        direction: Schema.optional(
          Schema.Literal('asc', 'desc').pipe(
            Schema.annotations({
              description: 'Sort direction: asc (default) or desc',
            })
          )
        ),
      }).pipe(
        Schema.annotations({
          description: 'Sort configuration for the released items',
        })
      )
    ),

    /** Maximum number of items to release */
    limit: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.positive(),
        Schema.annotations({
          description: 'Maximum number of items to release from the bucket',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'DigestReleaseAction',
    title: 'Digest Release Action',
    description: 'Release all collected items from a digest bucket',
  })
)

/** @public */
export type DigestReleaseAction = Schema.Schema.Type<typeof DigestReleaseActionSchema>
