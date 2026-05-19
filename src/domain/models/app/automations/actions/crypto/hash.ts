/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const CryptoHashActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('crypto'),
  operator: Schema.Literal('hash'),
  props: Schema.Struct({
    input: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Input string to hash (supports template variables)',
      })
    ),

    algorithm: Schema.Literal('md5', 'sha256', 'sha512').pipe(
      Schema.annotations({
        description: 'Hash algorithm: md5, sha256, or sha512',
      })
    ),

    encoding: Schema.optional(
      Schema.Literal('hex', 'base64').pipe(
        Schema.annotations({
          description: 'Output encoding: hex (default) or base64',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'CryptoHashAction',
    title: 'Crypto Hash Action',
    description: 'Compute a cryptographic hash of the input string',
  })
)

export type CryptoHashAction = Schema.Schema.Type<typeof CryptoHashActionSchema>
