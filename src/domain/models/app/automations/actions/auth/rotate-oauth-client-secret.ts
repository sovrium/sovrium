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
 * Auth Rotate OAuth Client Secret Action (type: auth, operator: rotateOAuthClientSecret)
 *
 * Replace the secret of a client `registerOAuthClient` registered. The old
 * secret stops working at once; the client id does not change.
 *
 * Output: `{ clientId, clientSecret }`. The secret is recorded as `***` in the
 * run history.
 */
export const AuthRotateOAuthClientSecretActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('auth').pipe(
    Schema.annotate({
      description: "Constant value 'auth' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('rotateOAuthClientSecret').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'auth' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    clientId: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Client id of the client whose secret is replaced' })
    ),
  }).annotate({
    description: 'The client whose secret is replaced.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'AuthRotateOAuthClientSecretAction',
    title: 'Auth Rotate OAuth Client Secret Action',
    description: "Replace a sign-in client's secret; the old one stops working at once",
  })
)

/** @public */
export type AuthRotateOAuthClientSecretAction = Schema.Schema.Type<
  typeof AuthRotateOAuthClientSecretActionSchema
>
