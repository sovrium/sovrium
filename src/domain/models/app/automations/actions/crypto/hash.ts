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
 * Crypto Hash Action (type: crypto, operator: hash)
 *
 * Compute a cryptographic hash of the input string.
 * Supports MD5, SHA-256, and SHA-512 algorithms with hex or base64 encoding.
 */
export const CryptoHashActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('crypto'),
  operator: Schema.Literal('hash'),
  props: Schema.Struct({
    /** Input string to hash */
    input: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Input string to hash (supports template variables)',
      })
    ),

    /** Hash algorithm */
    algorithm: Schema.Literal('md5', 'sha256', 'sha512').pipe(
      Schema.annotations({
        description: 'Hash algorithm: md5, sha256, or sha512',
      })
    ),

    /** Output encoding */
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

/** @public */
export type CryptoHashAction = Schema.Schema.Type<typeof CryptoHashActionSchema>
