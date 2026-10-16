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
 * Auth List Grantees Action (type: auth, operator: listGrantees)
 *
 * List the accounts holding a grant over one record of a scope table — who can
 * see this project. The step outputs `{ grantees, count }`, each grantee
 * `{ id, email, name, role }`, so a later step can mail every one of them or
 * loop over them.
 */
export const AuthListGranteesActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('auth').pipe(
    Schema.annotate({
      description: "Constant value 'auth' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('listGrantees').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'auth' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    table: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'The scope table the record belongs to. A table auth.scopeTables does not list is refused by sovrium validate when written literally, and fails the step when it arrives through a template.',
      })
    ),
    recordId: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'The id of the record whose grantees are listed' })
    ),
    role: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'Only the accounts holding the record under this role. All roles when omitted. A role auth.roles does not declare is refused by sovrium validate when written literally, and fails the step when it arrives through a template.',
        })
      )
    ),
  }).annotate({
    description: 'Which record of which scope table, and optionally which role.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'AuthListGranteesAction',
    title: 'Auth List Grantees Action',
    description:
      'List the accounts granted access to one record of a scope table, as { grantees, count }',
  })
)

/** @public */
export type AuthListGranteesAction = Schema.Schema.Type<typeof AuthListGranteesActionSchema>
