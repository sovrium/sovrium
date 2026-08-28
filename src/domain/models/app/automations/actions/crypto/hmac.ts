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
 * Crypto HMAC Action (type: crypto, operator: hmac)
 *
 * Compute an HMAC (Hash-based Message Authentication Code) for the input string.
 * Useful for webhook signature verification and secure message authentication.
 */
export const CryptoHmacActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('crypto'),
  operator: Schema.Literal('hmac'),
  props: Schema.Struct({
    /** Input string to sign */
    input: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Input string to sign (supports template variables)',
      })
    ),

    /** Secret key for HMAC computation */
    secret: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Secret key for HMAC computation (supports template variables)',
      })
    ),

    /** HMAC algorithm */
    algorithm: Schema.Literals(['sha256', 'sha512']).pipe(
      Schema.annotate({
        description: 'HMAC algorithm: sha256 or sha512',
      })
    ),

    /** Output encoding */
    encoding: Schema.optional(
      Schema.Literals(['hex', 'base64']).pipe(
        Schema.annotate({
          description: 'Output encoding: hex (default) or base64',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotate({
    identifier: 'CryptoHmacAction',
    title: 'Crypto HMAC Action',
    description: 'Compute an HMAC for secure message authentication',
  })
)

/** @public */
export type CryptoHmacAction = Schema.Schema.Type<typeof CryptoHmacActionSchema>
