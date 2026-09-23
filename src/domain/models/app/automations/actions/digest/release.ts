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
  type: Schema.Literal('digest').pipe(
    Schema.annotate({
      description: "Constant value 'digest' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('release').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'digest' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Digest bucket identifier to release */
    digestKey: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Digest bucket identifier to release (supports template variables)',
      })
    ),

    /** Sort configuration for released items */
    sort: Schema.optional(
      Schema.Struct({
        /** Field to sort by */
        field: TemplateStringSchema.pipe(
          Schema.annotate({
            description: 'Field name to sort by (supports template variables)',
          })
        ),

        /** Sort direction */
        direction: Schema.optional(
          Schema.Literals(['asc', 'desc']).pipe(
            Schema.annotate({
              description: 'Sort direction: asc (default) or desc',
            })
          )
        ),
      }).pipe(
        Schema.annotate({
          description: 'Sort configuration for the released items',
        })
      )
    ),

    /** Maximum number of items to release */
    limit: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description: 'Maximum number of items to release from the bucket',
        }),
        Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
      )
    ),
  }).annotate({
    description: 'Which digest to release, in what order, and how many entries at most.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'DigestReleaseAction',
    title: 'Digest Release Action',
    description: 'Release all collected items from a digest bucket',
  })
)

/** @public */
export type DigestReleaseAction = Schema.Schema.Type<typeof DigestReleaseActionSchema>
