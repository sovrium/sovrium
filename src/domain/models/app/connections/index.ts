/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { OAuth2PropsSchema, ApiKeyPropsSchema, BasicPropsSchema, BearerPropsSchema } from './props'


const ConnectionBaseFields = {
  name: Schema.String.pipe(
    Schema.pattern(/^[a-z][a-z0-9-]*$/),
    Schema.maxLength(100),
    Schema.annotations({
      description: 'Connection name (kebab-case). Referenced in actions as $connection.NAME',
    })
  ),

  label: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Human-readable label for this connection' })
    )
  ),

  description: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Description of this connection and its purpose' })
    )
  ),
}


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

export type Connection = Schema.Schema.Type<typeof ConnectionSchema>


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

export type Connections = Schema.Schema.Type<typeof ConnectionsSchema>
