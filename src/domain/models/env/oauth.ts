/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

const OAuthCredentials = Schema.Struct({
  clientId: Schema.optional(Schema.String),
  clientSecret: Schema.optional(Schema.String),
})

export const OAuthEnvSchema = Schema.Struct({
  google: Schema.optional(OAuthCredentials),
  github: Schema.optional(OAuthCredentials),
  microsoft: Schema.optional(OAuthCredentials),
  slack: Schema.optional(OAuthCredentials),
  gitlab: Schema.optional(OAuthCredentials),
})

export type OAuthEnvConfig = Schema.Schema.Type<typeof OAuthEnvSchema>

const readCredentials = (prefix: string) => {
  const clientId = process.env[`${prefix}_CLIENT_ID`]
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`]
  if (!clientId && !clientSecret) return undefined
  return { clientId, clientSecret }
}

export const parseOAuthEnvConfig = (): OAuthEnvConfig =>
  Schema.decodeUnknownSync(OAuthEnvSchema)({
    google: readCredentials('GOOGLE'),
    github: readCredentials('GITHUB'),
    microsoft: readCredentials('MICROSOFT'),
    slack: readCredentials('SLACK'),
    gitlab: readCredentials('GITLAB'),
  })
