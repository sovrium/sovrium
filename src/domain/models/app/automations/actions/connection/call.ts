/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'

/**
 * Connection Call Action (type: connection, operator: call)
 *
 * Calls one operation declared on a connection (`connections[].operations[]`)
 * by name. The connection supplies the base URL and the authentication; the
 * operation supplies the method, the path and the typed parameters. The step
 * output is `steps.<name>.data` (the decoded body, or with `paginate` the items
 * of every page read) and `steps.<name>.response.status` / `.headers`.
 */
export const ConnectionCallActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('connection').pipe(
    Schema.annotate({
      description: "Constant value 'connection' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('call').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'connection' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    connection: Schema.String.pipe(
      Schema.annotate({
        description:
          'Name of the connection declaring the operation (must reference app.connections[])',
      }),
      Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/))
    ),
    operation: Schema.String.pipe(
      Schema.annotate({
        description:
          "Name of the operation to call (must be declared in that connection's operations)",
      }),
      Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/))
    ),
    params: Schema.optional(
      Schema.Record(
        Schema.String.pipe(
          Schema.annotate({ description: 'A parameter name declared by the operation' })
        ),
        Schema.Unknown
      ).pipe(
        Schema.annotate({
          howTo:
            'Pass literals or template variables. A literal of the wrong type, an unknown name or a missing required parameter is refused when the config loads.',
          description:
            'Values for the operation parameters, by name (supports template variables and $env)',
        })
      )
    ),
    paginate: Schema.optional(
      Schema.Union([
        Schema.Literal('all').pipe(
          Schema.annotate({ description: 'Read every page until the last one' })
        ),
        Schema.Finite.pipe(
          Schema.annotate({ description: 'Read at most this many pages (1-1000)' }),
          Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 1000 }))
        ),
      ]).pipe(
        Schema.annotate({
          defaultNote: 'first page only',
          description:
            "Read several pages of a paginated operation and return their items as one array in `data`. Needs the operation's `pagination`.",
        })
      )
    ),
    timeout: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          defaultNote: '15000',
          description: 'Timeout for each request in ms (1000-120000)',
        }),
        Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1000, maximum: 120_000 }))
      )
    ),
  }).annotate({
    description: 'Which operation of which connection to call, with what, and how many pages.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'ConnectionCallAction',
    title: 'Connection Call Action',
    description:
      'Call an operation declared on a connection, with typed parameters, authentication, pagination and retry on rate limits handled by Sovrium.',
  })
)

export type ConnectionCallAction = Schema.Schema.Type<typeof ConnectionCallActionSchema>
