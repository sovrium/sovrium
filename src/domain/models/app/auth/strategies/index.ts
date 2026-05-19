/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { OAuthProviderSchema } from './oauth/providers'

export const EmailAndPasswordStrategySchema = Schema.Struct({
  type: Schema.Literal('emailAndPassword'),
  minPasswordLength: Schema.optional(
    Schema.Number.pipe(
      Schema.between(6, 128),
      Schema.annotations({ description: 'Minimum password length (6-128, default: 8)' })
    )
  ),
  maxPasswordLength: Schema.optional(
    Schema.Number.pipe(
      Schema.between(8, 256),
      Schema.annotations({ description: 'Maximum password length (8-256, default: 128)' })
    )
  ),
  requireEmailVerification: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description: 'Require email verification before sign-in (default: false)',
      })
    )
  ),
  autoSignIn: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Auto sign in after signup (default: true)' })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'Email and Password Strategy',
    description: 'Traditional credential-based authentication strategy',
    examples: [
      { type: 'emailAndPassword' as const },
      { type: 'emailAndPassword' as const, minPasswordLength: 12 },
    ],
  })
)

export type EmailAndPasswordStrategy = Schema.Schema.Type<typeof EmailAndPasswordStrategySchema>

export const MagicLinkStrategySchema = Schema.Struct({
  type: Schema.Literal('magicLink'),
  expirationMinutes: Schema.optional(
    Schema.Number.pipe(
      Schema.positive(),
      Schema.annotations({ description: 'Link expiration time in minutes (default: 15)' })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'Magic Link Strategy',
    description: 'Passwordless authentication via email link',
    examples: [
      { type: 'magicLink' as const },
      { type: 'magicLink' as const, expirationMinutes: 30 },
    ],
  })
)

export type MagicLinkStrategy = Schema.Schema.Type<typeof MagicLinkStrategySchema>

export const OAuthStrategySchema = Schema.Struct({
  type: Schema.Literal('oauth'),
  providers: Schema.NonEmptyArray(OAuthProviderSchema).pipe(
    Schema.annotations({
      description: 'OAuth providers to enable. Credentials loaded from environment variables.',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'OAuth Strategy',
    description: 'Social login with OAuth providers (google, github, microsoft, slack, gitlab)',
    examples: [{ type: 'oauth' as const, providers: ['google', 'github'] }],
  })
)

export type OAuthStrategy = Schema.Schema.Type<typeof OAuthStrategySchema>

export const AuthStrategySchema = Schema.Union(
  EmailAndPasswordStrategySchema,
  MagicLinkStrategySchema,
  OAuthStrategySchema
).pipe(
  Schema.annotations({
    title: 'Auth Strategy',
    description:
      'Authentication strategy configuration. Discriminated by `type` field: emailAndPassword, magicLink, or oauth.',
    examples: [
      { type: 'emailAndPassword' as const },
      { type: 'magicLink' as const },
      { type: 'oauth' as const, providers: ['google', 'github'] },
    ],
  })
)

export type AuthStrategy = Schema.Schema.Type<typeof AuthStrategySchema>

export const AuthStrategiesSchema = Schema.NonEmptyArray(AuthStrategySchema).pipe(
  Schema.filter((strategies) => {
    const types = strategies.map((s) => s.type)
    const uniqueTypes = new Set(types)
    if (uniqueTypes.size !== types.length) {
      return 'Duplicate strategy types are not allowed. Each strategy type can only appear once.'
    }
    return undefined
  }),
  Schema.annotations({
    title: 'Auth Strategies',
    description: 'Array of authentication strategies. At least one required, no duplicates.',
    examples: [
      [{ type: 'emailAndPassword' as const }],
      [
        { type: 'emailAndPassword' as const, minPasswordLength: 12 },
        { type: 'oauth' as const, providers: ['google'] },
      ],
    ],
  })
)

export type AuthStrategies = Schema.Schema.Type<typeof AuthStrategiesSchema>
