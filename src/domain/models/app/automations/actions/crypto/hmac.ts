/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const CryptoHmacActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('crypto'),
  operator: Schema.Literal('hmac'),
  props: Schema.Struct({
    input: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Input string to sign (supports template variables)',
      })
    ),

    secret: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Secret key for HMAC computation (supports template variables)',
      })
    ),

    algorithm: Schema.Literal('sha256', 'sha512').pipe(
      Schema.annotations({
        description: 'HMAC algorithm: sha256 or sha512',
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
    identifier: 'CryptoHmacAction',
    title: 'Crypto HMAC Action',
    description: 'Compute an HMAC for secure message authentication',
  })
)

export type CryptoHmacAction = Schema.Schema.Type<typeof CryptoHmacActionSchema>
