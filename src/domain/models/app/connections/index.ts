/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { OAuth2PropsSchema, ApiKeyPropsSchema, BasicPropsSchema, BearerPropsSchema } from './props'

// ─── Connection Base Fields ──────────────────────────────────────────────────

const ConnectionBaseFields = {
  /** Connection name (kebab-case identifier, used as $connection.NAME) */
  name: Schema.String.pipe(
    Schema.pattern(/^[a-z][a-z0-9-]*$/),
    Schema.maxLength(100),
    Schema.annotations({
      description: 'Connection name (kebab-case). Referenced in actions as $connection.NAME',
    })
  ),

  /** Human-readable label */
  label: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Human-readable label for this connection' })
    )
  ),

  /** Description of what this connection is for */
  description: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Description of this connection and its purpose' })
    )
  ),
}

// ─── OAuth2 Connection ───────────────────────────────────────────────────────

export const OAuth2ConnectionSchema = Schema.Struct({
  ...ConnectionBaseFields,
  type: Schema.Literal('oauth2'),
  props: OAuth2PropsSchema,
}).pipe(
  Schema.annotations({
    identifier: 'OAuth2Connection',
    title: 'OAuth2 Connection',
    description: 'OAuth2 authentication for external services',
  })
)

// ─── API Key Connection ──────────────────────────────────────────────────────

export const ApiKeyConnectionSchema = Schema.Struct({
  ...ConnectionBaseFields,
  type: Schema.Literal('apiKey'),
  props: ApiKeyPropsSchema,
}).pipe(
  Schema.annotations({
    identifier: 'ApiKeyConnection',
    title: 'API Key Connection',
    description: 'API key authentication via HTTP header',
  })
)

// ─── Basic Auth Connection ───────────────────────────────────────────────────

export const BasicConnectionSchema = Schema.Struct({
  ...ConnectionBaseFields,
  type: Schema.Literal('basic'),
  props: BasicPropsSchema,
}).pipe(
  Schema.annotations({
    identifier: 'BasicConnection',
    title: 'Basic Auth Connection',
    description: 'HTTP Basic authentication (username/password)',
  })
)

// ─── Bearer Token Connection ─────────────────────────────────────────────────

export const BearerConnectionSchema = Schema.Struct({
  ...ConnectionBaseFields,
  type: Schema.Literal('bearer'),
  props: BearerPropsSchema,
}).pipe(
  Schema.annotations({
    identifier: 'BearerConnection',
    title: 'Bearer Token Connection',
    description: 'Bearer token authentication via Authorization header',
  })
)

// ─── Connection Union ────────────────────────────────────────────────────────

export const ConnectionSchema = Schema.Union(
  OAuth2ConnectionSchema,
  ApiKeyConnectionSchema,
  BasicConnectionSchema,
  BearerConnectionSchema
).pipe(
  Schema.annotations({
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
  Schema.annotations({
    identifier: 'Connections',
    title: 'Connections',
    description: 'External service connections for authenticated HTTP actions',
  }),
  Schema.filter((connections) => {
    const names = connections.map((c) => c.name)
    const uniqueNames = new Set(names)
    return names.length === uniqueNames.size || 'Connection names must be unique'
  })
)

/** @public */
export type Connections = Schema.Schema.Type<typeof ConnectionsSchema>
