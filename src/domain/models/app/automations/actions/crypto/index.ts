/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { CryptoHashActionSchema } from './hash'
import { CryptoHmacActionSchema } from './hmac'

/**
 * Crypto Action — union of all cryptographic operators
 */
export const CryptoActionSchema = Schema.Union(CryptoHashActionSchema, CryptoHmacActionSchema).pipe(
  Schema.annotations({
    identifier: 'CryptoAction',
    title: 'Crypto Action',
    description: 'Cryptographic operations: hashing and HMAC computation',
  })
)

/** @public */
export type CryptoAction = Schema.Schema.Type<typeof CryptoActionSchema>

export * from './hash'
export * from './hmac'
