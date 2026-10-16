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
 * Auth Grant Access Action (type: auth, operator: grantAccess)
 *
 * Give an account access to one record of a scope table (`auth.scopeTables`)
 * under one role — the same grant an admin mints through the access-grant
 * routes. Idempotent: granting an account a record it already holds under that
 * role succeeds and changes nothing.
 */
export const AuthGrantAccessActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('auth').pipe(
    Schema.annotate({
      description: "Constant value 'auth' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('grantAccess').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'auth' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    userId: TemplateStringSchema.pipe(Schema.annotate({ description: 'The account given access' })),
    table: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'The scope table the record belongs to. A table auth.scopeTables does not list is refused by sovrium validate when written literally, and fails the step when it arrives through a template.',
      })
    ),
    recordId: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'The id of the record the account is given access to' })
    ),
    role: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'The role the account holds over the record. A role auth.roles does not declare is refused by sovrium validate when written literally, and fails the step when it arrives through a template.',
      })
    ),
  }).annotate({
    description: 'Which account is given which record of which scope table, under which role.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'AuthGrantAccessAction',
    title: 'Auth Grant Access Action',
    description:
      'Give an account access to one record of a scope table under a role; granting it again changes nothing',
  })
)

/** @public */
export type AuthGrantAccessAction = Schema.Schema.Type<typeof AuthGrantAccessActionSchema>
