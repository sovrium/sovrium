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

/**
 * OAuth provider environment configuration.
 *
 * Env vars: {PROVIDER}_CLIENT_ID, {PROVIDER}_CLIENT_SECRET
 * Providers: Google, GitHub, Microsoft, Slack, GitLab
 */
export const OAuthEnvSchema = Schema.Struct({
  google: Schema.optional(OAuthCredentials),
  github: Schema.optional(OAuthCredentials),
  microsoft: Schema.optional(OAuthCredentials),
  slack: Schema.optional(OAuthCredentials),
  gitlab: Schema.optional(OAuthCredentials),
})
