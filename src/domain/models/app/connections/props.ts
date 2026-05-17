/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../automations/template'

/**
 * Connection props are type-specific, defined per connection variant.
 *
 * This file extracts the individual prop schemas so they can be imported
 * independently from the connection union. Each connection type has its
 * own props shape.
 */

// ─── OAuth2 Props ───────────────────────────────────────────────────────────

export const OAuth2PropsSchema = Schema.Struct({
  provider: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description:
          'Known provider shorthand (e.g., google, github, slack). If set, authorizationUrl/tokenUrl may be inferred.',
      })
    )
  ),
  clientId: TemplateStringSchema.pipe(
    Schema.annotations({ description: 'OAuth2 client ID (supports $env.VAR)' })
  ),
  clientSecret: TemplateStringSchema.pipe(
    Schema.annotations({ description: 'OAuth2 client secret (supports $env.VAR)' })
  ),
  authorizationUrl: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Authorization endpoint URL (required for custom providers)',
      })
    )
  ),
  tokenUrl: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Token endpoint URL (required for custom providers)' })
    )
  ),
  scopes: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotations({ description: 'OAuth2 scopes to request' })
    )
  ),
  redirectUri: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotations({
        description:
          'Redirect URI registered with the OAuth2 provider. Required at runtime — auto-generation from app URL is not yet implemented; if omitted, the OAuth call will fail with a provider-side error.',
      })
    )
  ),
  grantType: Schema.optional(
    Schema.Literal('authorizationCode', 'clientCredentials').pipe(
      Schema.annotations({
        description: 'OAuth2 grant type (default: authorizationCode)',
      })
    )
  ),
  pkce: Schema.optional(
    Schema.Literal('S256', 'plain', 'none').pipe(
      Schema.annotations({
        description: 'PKCE challenge method: S256 (recommended), plain, or none (default: none)',
      })
    )
  ),
  audience: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'API audience/resource identifier (e.g., Auth0 audience URL)',
      })
    )
  ),
  authenticationMethod: Schema.optional(
    Schema.Literal('header', 'body').pipe(
      Schema.annotations({
        description:
          'How client credentials are sent on token-endpoint requests. "header" (default) sends them via HTTP Basic auth (RFC 6749 §2.3.1, the prescribed scheme). "body" sends client_id/client_secret as form parameters. Honored by the refresh-token grant (token-refresh.ts); the initial authorization_code exchange currently always uses "body" regardless of this value.',
      })
    )
  ),
  extraAuthParams: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String }).pipe(
      Schema.annotations({
        description:
          'Custom parameters appended to the authorization URL (e.g., access_type: offline, prompt: consent)',
      })
    )
  ),
  extraTokenParams: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String }).pipe(
      Schema.annotations({
        description: 'Custom parameters appended to token exchange requests',
      })
    )
  ),
  scope: Schema.optional(
    Schema.Literal('app', 'user').pipe(
      Schema.annotations({
        description:
          'Connection scope: app (admin-only, shared token) or user (per-user tokens). Default: app',
      })
    )
  ),
  /**
   * Internal test-mode escape hatch consumed by the user-create token
   * seeder (`infrastructure/connections/test-token-seeder.ts`). The
   * seeder's default behavior is to upsert a sentinel-shaped token with
   * `expiresAt = now + 1h` so that encryption-at-rest specs have a row
   * to assert against without driving a real OAuth round-trip. The
   * deepened token-refresh specs (APP-AUTOMATION-CONNECTION-078..083)
   * need the OPPOSITE: a non-sentinel token with `expiresAt < now()`
   * so the very next automation trigger sees an expired token and
   * fires a refresh request. `_test.seedExpired: true` flips the
   * seeder into that mode.
   *
   * Production safety: the seeder no-ops entirely when
   * `NODE_ENV === 'production'` (see `runSeedTestConnectionTokens`).
   * The leading underscore in the field name signals "internal test
   * affordance, not a public schema feature" — exposed in the schema
   * only because Effect Schema's default is to STRIP unknown keys
   * during decoding, which would erase this flag before the seeder
   * ever sees it. Keeping it visible is the price of preserving it.
   */
  _test: Schema.optional(
    Schema.Struct({
      seedExpired: Schema.optional(Schema.Boolean),
      /**
       * Per-user variant: only seed an expired token for the listed
       * email addresses; other users get the default (sentinel or
       * authorized-loopback) seeder behavior. Used by the
       * cross-user-isolation specs (APP-AUTOMATION-CONNECTION-095) to
       * fail Alice's refresh while leaving Bob's row untouched.
       */
      seedExpiredFor: Schema.optional(Schema.Array(Schema.String)),
    }).pipe(
      Schema.annotations({
        description:
          'Internal: test-mode seeder hints. Ignored in production (NODE_ENV=production no-ops the seeder).',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'OAuth2Props',
    title: 'OAuth2 Connection Props',
    description: 'Properties for OAuth2 authentication connections',
  })
)

/** @public */
export type OAuth2Props = Schema.Schema.Type<typeof OAuth2PropsSchema>

// ─── API Key Props ──────────────────────────────────────────────────────────

export const ApiKeyPropsSchema = Schema.Struct({
  key: TemplateStringSchema.pipe(
    Schema.annotations({
      description: 'API key value (typically $env.VAR for security)',
    })
  ),
  header: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Header name for the API key (default: X-API-Key)',
      })
    )
  ),
  prefix: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Prefix before the key value in the header (e.g., "Bearer", "Token")',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'ApiKeyProps',
    title: 'API Key Connection Props',
    description: 'Properties for API key authentication connections',
  })
)

/** @public */
export type ApiKeyProps = Schema.Schema.Type<typeof ApiKeyPropsSchema>

// ─── Basic Auth Props ───────────────────────────────────────────────────────

export const BasicPropsSchema = Schema.Struct({
  username: TemplateStringSchema.pipe(
    Schema.annotations({ description: 'Username (supports $env.VAR)' })
  ),
  password: TemplateStringSchema.pipe(
    Schema.annotations({ description: 'Password (supports $env.VAR)' })
  ),
}).pipe(
  Schema.annotations({
    identifier: 'BasicProps',
    title: 'Basic Auth Connection Props',
    description: 'Properties for HTTP Basic authentication connections',
  })
)

/** @public */
export type BasicProps = Schema.Schema.Type<typeof BasicPropsSchema>

// ─── Bearer Token Props ─────────────────────────────────────────────────────

export const BearerPropsSchema = Schema.Struct({
  token: TemplateStringSchema.pipe(
    Schema.annotations({
      description: 'Bearer token value (typically $env.VAR for security)',
    })
  ),
}).pipe(
  Schema.annotations({
    identifier: 'BearerProps',
    title: 'Bearer Token Connection Props',
    description: 'Properties for Bearer token authentication connections',
  })
)

/** @public */
export type BearerProps = Schema.Schema.Type<typeof BearerPropsSchema>
