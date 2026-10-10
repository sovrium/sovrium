/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/**
 * Auth Delete OAuth Client Action (type: auth, operator: deleteOAuthClient)
 *
 * Delete a client `registerOAuthClient` registered. Sign-in through it stops
 * working and the tokens it obtained stop being accepted.
 *
 * Output: `{ clientId, deleted }` — `deleted` is `false` when no such client
 * existed, so a workflow deleting a client twice does not fail.
 */
export const AuthDeleteOAuthClientActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('auth').pipe(
    Schema.annotate({
      description: "Constant value 'auth' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('deleteOAuthClient').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'auth' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    clientId: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Client id of the client to delete' })
    ),
  }).annotate({
    description: 'The client to delete.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'AuthDeleteOAuthClientAction',
    title: 'Auth Delete OAuth Client Action',
    description: 'Delete a sign-in client; sign-in through it and its tokens stop working',
  })
)

/** @public */
export type AuthDeleteOAuthClientAction = Schema.Schema.Type<
  typeof AuthDeleteOAuthClientActionSchema
>
