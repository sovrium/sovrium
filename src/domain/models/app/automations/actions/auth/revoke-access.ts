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
 * Auth Revoke Access Action (type: auth, operator: revokeAccess)
 *
 * Take one record of a scope table away from an account: the record leaves
 * every grant of that account over that table — or, with `role`, only the
 * grant held under that role — and a grant left naming no record is deleted.
 * Idempotent: revoking a record the account does not hold succeeds and changes
 * nothing.
 */
export const AuthRevokeAccessActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('auth').pipe(
    Schema.annotate({
      description: "Constant value 'auth' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('revokeAccess').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'auth' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    userId: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'The account losing access' })
    ),
    table: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'The scope table the record belongs to. A table auth.scopeTables does not list is refused by sovrium validate when written literally, and fails the step when it arrives through a template.',
      })
    ),
    recordId: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'The id of the record taken away from the account' })
    ),
    role: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'Only the grant the account holds under this role loses the record; its grants under other roles keep it. Every role when omitted. A role auth.roles does not declare is refused by sovrium validate when written literally, and fails the step when it arrives through a template.',
        })
      )
    ),
  }).annotate({
    description:
      'Which account loses which record of which scope table, and optionally under which role.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'AuthRevokeAccessAction',
    title: 'Auth Revoke Access Action',
    description:
      "Take one record of a scope table away from an account's grants; revoking it again changes nothing",
  })
)

/** @public */
export type AuthRevokeAccessAction = Schema.Schema.Type<typeof AuthRevokeAccessActionSchema>
