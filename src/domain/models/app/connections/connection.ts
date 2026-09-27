/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { providerIssue } from './oauth2-provider-validation'
import { ConnectionOperationsSchema, operationsIssue } from './operations'
import {
  OAuth2PropsSchema,
  ApiKeyPropsSchema,
  BasicPropsSchema,
  BearerPropsSchema,
  TokenExchangePropsSchema,
} from './props'

// ─── Connection Base Fields ──────────────────────────────────────────────────

const ConnectionBaseFields = {
  /** Connection name (kebab-case identifier, used as $connection.NAME) */
  name: Schema.String.pipe(
    Schema.annotate({
      description: 'Connection name (kebab-case). Referenced in actions as $connection.NAME',
    }),
    Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/), Schema.isMaxLength(100))
  ),

  /** Human-readable label */
  label: Schema.optional(
    Schema.String.pipe(Schema.annotate({ description: 'Human-readable label for this connection' }))
  ),

  /** Description of what this connection is for */
  description: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({ description: 'Description of this connection and its purpose' })
    )
  ),

  /** Root URL of the service's API; every operation path is appended to it */
  baseUrl: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Root URL of the service API: an http(s) URL, $env.VAR, or $token.FIELD for a URL the provider returns with the token (declared in the OAuth2 tokenFields). Each operation path is appended to it, and every call passes the same outbound-address guard as the http actions. Required when the connection declares operations.',
        examples: ['https://thirdparty.qonto.com/v2', '$env.SALESFORCE_INSTANCE_URL'],
      }),
      Schema.check(
        Schema.isPattern(
          /^(https?:\/\/\S+|\$env\.[A-Z][A-Z0-9_]*\S*|\$token\.[a-z_][a-z0-9_]*\S*)$/
        )
      )
    )
  ),

  /** Endpoints of the service, callable by name from automation steps */
  operations: Schema.optional(ConnectionOperationsSchema),
}

// ─── OAuth2 Connection ───────────────────────────────────────────────────────

export const OAuth2ConnectionSchema = Schema.Struct({
  ...ConnectionBaseFields,
  type: Schema.Literal('oauth2').pipe(
    Schema.annotate({
      description: "Constant value 'oauth2' for type discrimination in discriminated unions",
    })
  ),
  props: OAuth2PropsSchema,
}).pipe(
  Schema.annotate({
    identifier: 'OAuth2Connection',
    title: 'OAuth2 Connection',
    description: 'OAuth2 authentication for external services',
  })
)

// ─── API Key Connection ──────────────────────────────────────────────────────

export const ApiKeyConnectionSchema = Schema.Struct({
  ...ConnectionBaseFields,
  type: Schema.Literal('apiKey').pipe(
    Schema.annotate({
      description: "Constant value 'apiKey' for type discrimination in discriminated unions",
    })
  ),
  props: ApiKeyPropsSchema,
}).pipe(
  Schema.annotate({
    identifier: 'ApiKeyConnection',
    title: 'API Key Connection',
    description: 'API key authentication via HTTP header',
  })
)

// ─── Basic Auth Connection ───────────────────────────────────────────────────

export const BasicConnectionSchema = Schema.Struct({
  ...ConnectionBaseFields,
  type: Schema.Literal('basic').pipe(
    Schema.annotate({
      description: "Constant value 'basic' for type discrimination in discriminated unions",
    })
  ),
  props: BasicPropsSchema,
}).pipe(
  Schema.annotate({
    identifier: 'BasicConnection',
    title: 'Basic Auth Connection',
    description: 'HTTP Basic authentication (username/password)',
  })
)

// ─── Bearer Token Connection ─────────────────────────────────────────────────

export const BearerConnectionSchema = Schema.Struct({
  ...ConnectionBaseFields,
  type: Schema.Literal('bearer').pipe(
    Schema.annotate({
      description: "Constant value 'bearer' for type discrimination in discriminated unions",
    })
  ),
  props: BearerPropsSchema,
}).pipe(
  Schema.annotate({
    identifier: 'BearerConnection',
    title: 'Bearer Token Connection',
    description: 'Bearer token authentication via Authorization header',
  })
)

// ─── Token Exchange Connection ───────────────────────────────────────────────

export const TokenExchangeConnectionSchema = Schema.Struct({
  ...ConnectionBaseFields,
  type: Schema.Literal('tokenExchange').pipe(
    Schema.annotate({
      description: "Constant value 'tokenExchange' for type discrimination in discriminated unions",
    })
  ),
  props: TokenExchangePropsSchema,
}).pipe(
  Schema.annotate({
    identifier: 'TokenExchangeConnection',
    title: 'Token Exchange Connection',
    description:
      'A credential exchanged at a token endpoint for a short-lived token, cached until it expires',
  })
)

// ─── Connection Union ────────────────────────────────────────────────────────

export const ConnectionSchema = Schema.Union([
  OAuth2ConnectionSchema,
  ApiKeyConnectionSchema,
  BasicConnectionSchema,
  BearerConnectionSchema,
  TokenExchangeConnectionSchema,
]).pipe(
  Schema.annotate({
    identifier: 'Connection',
    title: 'Connection',
    description:
      'External service connection for authenticated API calls. Referenced via $connection.NAME in actions.',
  })
)

/** @public */
export type Connection = Schema.Schema.Type<typeof ConnectionSchema>

// ─── Connections Array ───────────────────────────────────────────────────────

export const ConnectionsSchema = Schema.Array(ConnectionSchema).pipe(
  Schema.annotate({
    identifier: 'Connections',
    title: 'Connections',
    description: 'External service connections for authenticated HTTP actions',
  }),
  Schema.check(
    Schema.makeFilter((connections) => {
      const names = connections.map((c) => c.name)
      const uniqueNames = new Set(names)
      if (names.length !== uniqueNames.size) return 'Connection names must be unique'
      return (
        connections
          .flatMap((connection) => [providerIssue(connection), operationsIssue(connection)])
          .find((issue) => issue !== undefined) ?? true
      )
    })
  )
)

/** @public */
export type Connections = Schema.Schema.Type<typeof ConnectionsSchema>
