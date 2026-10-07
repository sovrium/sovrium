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
      Schema.annotate({
        description:
          'Known provider shorthand: airtable, github, google, hubspot, linkedin, microsoft, notion, salesforce or slack. It supplies the authorizationUrl and tokenUrl the connection leaves out; an explicit URL wins. Any other name is refused when the config loads unless both URLs are set.',
      })
    )
  ),
  clientId: TemplateStringSchema.pipe(
    Schema.annotate({ description: 'OAuth2 client ID (supports $env.VAR)' })
  ),
  clientSecret: TemplateStringSchema.pipe(
    Schema.annotate({ description: 'OAuth2 client secret (supports $env.VAR)' })
  ),
  authorizationUrl: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Authorization endpoint URL (required for custom providers)',
      })
    )
  ),
  tokenUrl: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Token endpoint URL (required for custom providers)' })
    )
  ),
  scopes: Schema.optional(
    Schema.Array(Schema.String).pipe(Schema.annotate({ description: 'OAuth2 scopes to request' }))
  ),
  redirectUri: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'Redirect URI registered with the OAuth2 provider. Defaults to the callback of the place the flow starts from: <base URL>/api/connections/<name>/callback from the app, <base URL>/api/admin/connections/<name>/callback from the operator console — the base URL being BASE_URL when set, otherwise the address the request arrived on. Register the callback of each place you connect from; set this only to use another address.',
      })
    )
  ),
  grantType: Schema.optional(
    Schema.Literals(['authorizationCode', 'clientCredentials']).pipe(
      Schema.annotate({
        description:
          'OAuth2 grant type (default: authorizationCode). clientCredentials is machine-to-machine: the token is requested with the client id and secret on first use, stored encrypted as the shared token, reused until it expires and then requested again — no one authorizes anything.',
      })
    )
  ),
  pkce: Schema.optional(
    Schema.Literals(['S256', 'plain', 'none']).pipe(
      Schema.annotate({
        description: 'PKCE challenge method: S256 (recommended), plain, or none (default: none)',
      })
    )
  ),
  audience: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'API audience/resource identifier (e.g., Auth0 audience URL)',
      })
    )
  ),
  authenticationMethod: Schema.optional(
    Schema.Literals(['header', 'body']).pipe(
      Schema.annotate({
        description:
          'How client credentials are sent on token-endpoint requests. "header" (default) sends them via HTTP Basic auth (RFC 6749 §2.3.1, the prescribed scheme). "body" sends client_id/client_secret as form parameters. Honored by the refresh-token and client-credentials grants; the initial authorization_code exchange currently always uses "body" regardless of this value.',
      })
    )
  ),
  extraAuthParams: Schema.optional(
    Schema.Record(Schema.String, Schema.String).pipe(
      Schema.annotate({
        description:
          'Custom parameters appended to the authorization URL (e.g., access_type: offline, prompt: consent)',
      })
    )
  ),
  extraTokenParams: Schema.optional(
    Schema.Record(Schema.String, Schema.String).pipe(
      Schema.annotate({
        description: 'Custom parameters appended to token exchange requests',
      })
    )
  ),
  scope: Schema.optional(
    Schema.Literals(['app', 'user']).pipe(
      Schema.annotate({
        description:
          'Connection scope: app (admin-only, shared token) or user (per-user tokens). Default: app',
      })
    )
  ),
  tokenFields: Schema.optional(
    Schema.Array(
      Schema.String.pipe(
        Schema.annotate({ description: 'Name of a field of the token response' }),
        Schema.check(Schema.isPattern(/^[a-z_][a-z0-9_]*$/))
      )
    ).pipe(
      Schema.annotate({
        howTo:
          "Salesforce returns the org's API root as `instance_url`: keep it with `tokenFields: [instance_url]` and set the connection's `baseUrl: $token.instance_url`.",
        description:
          'Fields of the token response to store with the token, readable as $token.NAME in the connection baseUrl. Refreshed with every new token.',
      })
    )
  ),
  /**
   * Providers that issue a short-lived token at the code exchange and a
   * long-lived one only on request — Meta's `fb_exchange_token` — with no
   * refresh token either way. The exchange runs at the callback, and again on
   * the first call inside the renewal window, so the stored token keeps
   * sliding forward while the connection is used.
   */
  longLivedToken: Schema.optional(
    Schema.Struct({
      style: Schema.Literal('meta').pipe(
        Schema.annotate({
          description:
            "The exchange to perform. 'meta': a GET to the tokenUrl with grant_type=fb_exchange_token, the client id and secret and the current token, answered with a token valid about 60 days.",
        })
      ),
      renewWithinDays: Schema.optional(
        Schema.Finite.pipe(
          Schema.annotate({
            defaultNote: '30',
            description:
              'When the stored long-lived token has at most this many days left, the next call exchanges it for a fresh one before using it.',
          }),
          Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 59 }))
        )
      ),
    }).pipe(
      Schema.annotate({
        howTo:
          'For a Facebook Page connection set `longLivedToken: { style: meta }`: without it the token from the code exchange stops working within hours.',
        description:
          'Exchange the short-lived token of the code exchange for a long-lived one at the callback, and renew it before it lapses.',
      })
    )
  ),
  /**
   * Internal test-mode escape hatch consumed by the user-create token
   * seeder (`infrastructure/connections/test-token-seeder.ts`). The
   * seeder's default behavior is to upsert a sentinel-shaped token with
   * `expiresAt = now + 1h` so that encryption-at-rest specs have a row
   * to assert against without driving a real OAuth round-trip. The
   * deepened token-refresh specs
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
      seedExpired: Schema.optional(
        Schema.Boolean.annotate({
          description:
            'Internal test hint: seeds an already-expired token so the refresh path can be exercised. Ignored in production.',
        })
      ),
      /**
       * Per-user variant: only seed an expired token for the listed
       * email addresses; other users get the default (sentinel or
       * authorized-loopback) seeder behavior. Used by the
       * cross-user-isolation specs to
       * fail Alice's refresh while leaving Bob's row untouched.
       */
      seedExpiredFor: Schema.optional(
        Schema.Array(Schema.String).annotate({
          description:
            'Internal test hint: seeds the expired token only for these email addresses. Ignored in production.',
        })
      ),
    }).pipe(
      Schema.annotate({
        description:
          'Internal: test-mode seeder hints. Ignored in production (NODE_ENV=production no-ops the seeder).',
      })
    )
  ),
}).pipe(
  Schema.annotate({
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
    Schema.annotate({
      description: 'API key value (typically $env.VAR for security)',
    })
  ),
  header: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'Header name for the API key (default: X-API-Key)',
      })
    )
  ),
  prefix: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'Prefix before the key value in the header (e.g., "Bearer", "Token")',
      })
    )
  ),
}).pipe(
  Schema.annotate({
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
    Schema.annotate({
      description:
        "Username (supports $env.VAR). May be empty for an API that takes its key as the password with an empty username (Lemlist): the pair is then sent as ':<password>'. A connection whose username and password are both empty fails the step.",
    })
  ),
  password: TemplateStringSchema.pipe(
    Schema.annotate({ description: 'Password (supports $env.VAR)' })
  ),
}).pipe(
  Schema.annotate({
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
    Schema.annotate({
      description: 'Bearer token value (typically $env.VAR for security)',
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'BearerProps',
    title: 'Bearer Token Connection Props',
    description: 'Properties for Bearer token authentication connections',
  })
)

/** @public */
export type BearerProps = Schema.Schema.Type<typeof BearerPropsSchema>

// ─── Token Exchange Props ───────────────────────────────────────────────────

/**
 * A credential exchanged at a token endpoint for a short-lived bearer: the
 * shape of APIs that hand out an access token for an API key or a client id
 * and secret without implementing OAuth2 (Spendesk, a number of French SaaS
 * back-offices). Sovrium posts `body` to `tokenUrl`, reads the token and its
 * lifetime from the answer, stores the token encrypted as the connection's
 * shared token, and asks again once it expires.
 */
export const TokenExchangePropsSchema = Schema.Struct({
  tokenUrl: TemplateStringSchema.pipe(
    Schema.annotate({
      description:
        'Endpoint that answers the credential with a token (an http(s) URL or $env.VAR). It passes the same outbound-address guard as the http actions.',
      examples: ['https://public-api.spendesk.com/v1/auth/token'],
    })
  ),
  body: Schema.Record(Schema.String, TemplateStringSchema).pipe(
    Schema.annotate({
      description:
        'Fields sent to tokenUrl, values resolved first — typically the key or the client id and secret, each as $env.VAR.',
      examples: [
        { client_id: '$env.SPENDESK_CLIENT_ID', client_secret: '$env.SPENDESK_CLIENT_SECRET' },
      ],
    })
  ),
  bodyType: Schema.optional(
    Schema.Literals(['json', 'form']).pipe(
      Schema.annotate({
        defaultNote: 'json',
        description:
          'How body is sent: a JSON object, or application/x-www-form-urlencoded fields.',
      })
    )
  ),
  tokenPath: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        defaultNote: 'access_token',
        description: 'Dot path of the token in the JSON answer (for example data.token).',
      }),
      Schema.check(Schema.isPattern(/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/))
    )
  ),
  expiresInPath: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        defaultNote: 'expires_in',
        description:
          "Dot path of the token's lifetime in seconds in the JSON answer. An answer without it is kept for one hour.",
      }),
      Schema.check(Schema.isPattern(/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/))
    )
  ),
  header: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        defaultNote: 'Authorization',
        description: 'Request header that carries the token on every call.',
      })
    )
  ),
  prefix: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        defaultNote: 'Bearer',
        description:
          "Text before the token in that header, followed by a space. '' sends the token alone.",
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'TokenExchangeProps',
    title: 'Token Exchange Connection Props',
    description:
      'Properties for a connection that exchanges a stored credential for a short-lived token',
  })
)

/** @public */
export type TokenExchangeProps = Schema.Schema.Type<typeof TokenExchangePropsSchema>
