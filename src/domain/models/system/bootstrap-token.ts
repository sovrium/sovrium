/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Data, Schema } from 'effect'


export const BootstrapTokenSchema = Schema.Struct({
  tokenHash: Schema.String.pipe(Schema.minLength(64), Schema.maxLength(64)),
  expiresAt: Schema.DateFromSelf,
  usedAt: Schema.optional(Schema.DateFromSelf),
  createdAt: Schema.DateFromSelf,
}).pipe(
  Schema.annotations({
    identifier: 'BootstrapToken',
    title: 'Bootstrap Token (persisted hash)',
    description: 'One-time bootstrap token persisted as SHA-256 hash. Plaintext is never stored.',
  })
)

export type BootstrapToken = typeof BootstrapTokenSchema.Type


export const BootstrapTokenClaimSchema = Schema.Struct({
  email: Schema.String.pipe(Schema.minLength(3)),
  password: Schema.String.pipe(Schema.minLength(8)),
  name: Schema.String.pipe(Schema.minLength(1)),
}).pipe(
  Schema.annotations({
    identifier: 'BootstrapTokenClaim',
    title: 'Bootstrap Token Claim Payload',
    description:
      'Body of POST /api/admin/bootstrap/claim. Bearer token is read from the Authorization header.',
  })
)

export type BootstrapTokenClaim = typeof BootstrapTokenClaimSchema.Type


export class BootstrapTokenNotFoundError extends Data.TaggedError('BootstrapTokenNotFoundError')<{
  readonly tokenHash: string
}> {}

export class BootstrapTokenExpiredError extends Data.TaggedError('BootstrapTokenExpiredError')<{
  readonly expiresAt: Date
}> {}

export class BootstrapTokenAlreadyUsedError extends Data.TaggedError(
  'BootstrapTokenAlreadyUsedError'
)<{
  readonly usedAt: Date
}> {}

export type BootstrapTokenError =
  BootstrapTokenNotFoundError | BootstrapTokenExpiredError | BootstrapTokenAlreadyUsedError
