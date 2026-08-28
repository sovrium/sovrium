/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema, SchemaGetter } from 'effect'

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

/** Env vars are always strings. Mirrors the helper in `env/mcp.ts`. */
const BooleanFromString = Schema.Literals(['true', 'false', 'TRUE', 'FALSE', '1', '0']).pipe(
  Schema.decodeTo(Schema.Boolean, {
    decode: SchemaGetter.transform(
      (s: 'true' | 'false' | 'TRUE' | 'FALSE' | '1' | '0') =>
        s === 'true' || s === 'TRUE' || s === '1'
    ),
    encode: SchemaGetter.transform((b: boolean) => (b ? ('true' as const) : ('false' as const))),
  })
)

/**
 * Sovrium's own OAuth AUTHORIZATION SERVER posture (distinct from
 * {@link OAuthEnvSchema}, which configures Sovrium as an OAuth *client* of
 * Google/GitHub/…).
 *
 * Env var: `SOVRIUM_OAUTH_ANONYMOUS_CLIENT_REGISTRATION`.
 */
export const OAuthServerEnvSchema = Schema.Struct({
  anonymousClientRegistration: Schema.optional(
    BooleanFromString.pipe(
      Schema.annotate({
        description:
          'Allow RFC 7591 dynamic client registration with NO session and no initial access token (SOVRIUM_OAUTH_ANONYMOUS_CLIENT_REGISTRATION). Default: false.',
      })
    )
  ),
})

/**
 * Whether this instance accepts ANONYMOUS dynamic client registration.
 *
 * Default `false`. Registration mints a `client_id` with an
 * attacker-chosen `client_name` and `redirect_uris`, and the name is what a
 * consent screen shows the user — so an open endpoint is a phishing primitive
 * and an unbounded write to `auth.oauth_client`. Better Auth's own default is
 * `false`, and for the MCP case this was enabled for, the upstream answer is
 * the `@better-auth/cimd` plugin (domain-verified Client ID Metadata
 * Documents) rather than open registration.
 *
 * The escape hatch exists because it is genuinely needed: Claude Desktop,
 * Cursor and ChatGPT Dev Mode all register BEFORE any browser session exists,
 * so an operator running Sovrium as a public MCP server must be able to
 * re-open it. That is an operator posture, not app-author intent, so it is an
 * env var and not an `app.auth.oauthServer.*` schema field (the [internal ref]
 * env-var-vs-schema split).
 *
 * An unparseable value is treated as `false` — the safe direction. A typo
 * (`SOVRIUM_OAUTH_ANONYMOUS_CLIENT_REGISTRATION=yes`) must not silently open
 * the endpoint, which is exactly what a permissive coercion would do.
 */
export const isAnonymousClientRegistrationEnabled = (
  env: NodeJS.ProcessEnv = process.env
): boolean => {
  const result = Schema.decodeUnknownResult(OAuthServerEnvSchema)({
    anonymousClientRegistration: env['SOVRIUM_OAUTH_ANONYMOUS_CLIENT_REGISTRATION'],
  })
  return result._tag === 'Success' ? (result.success.anonymousClientRegistration ?? false) : false
}
