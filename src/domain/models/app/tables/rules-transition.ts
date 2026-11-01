/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  BusinessRuleExemptRolesSchema,
  BusinessRuleMessageSchema,
  BusinessRuleNameSchema,
} from './rules-base'

/**
 * A transition: the moves a one-of field may make, from the value it holds to
 * the value a write sends.
 *
 * A write that leaves the field out, or sends the value it already holds,
 * passes. On a create the value must be one of `initial`, when it is declared.
 * That `field` is a `single-select` or `status` field and that every value is
 * one of its options is judged with the table's fields
 * (`business-rule-validation.ts`).
 *
 * @example
 * ```yaml
 * - name: invoice-status-flow
 *   kind: transition
 *   field: status
 *   initial: [draft]
 *   allow:
 *     - { from: draft, to: [validated] }
 *     - { from: validated, to: [paid, draft] }
 *     - { from: '*', to: [cancelled] }
 * ```
 */
export const TransitionStepSchema = Schema.Struct({
  from: Schema.String.pipe(
    Schema.annotate({
      description:
        'The value the field holds before the write, or `*` for any value, an empty field included.',
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  to: Schema.Array(
    Schema.String.pipe(
      Schema.annotate({ description: 'A value the field may move to from `from`.' }),
      Schema.check(Schema.isMinLength(1))
    )
  ).pipe(
    Schema.annotate({ description: 'The values the field may move to from `from`.' }),
    Schema.check(Schema.isMinLength(1))
  ),
}).pipe(
  Schema.annotate({
    identifier: 'TransitionStep',
    title: 'Transition Step',
    description: 'The values a field may move to from one value, or from any value with `*`.',
  })
)

export const TransitionRuleSchema = Schema.Struct({
  name: BusinessRuleNameSchema,
  kind: Schema.Literal('transition').annotate({
    description:
      'A transition lists the moves a `single-select` or `status` field may make; any other change of its value is refused.',
  }),
  field: Schema.String.pipe(
    Schema.annotate({
      description: 'The `single-select` or `status` field of this table whose moves are listed.',
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  initial: Schema.optional(
    Schema.Array(
      Schema.String.pipe(
        Schema.annotate({ description: 'A value a new record may start on.' }),
        Schema.check(Schema.isMinLength(1))
      )
    ).pipe(
      Schema.annotate({
        description:
          "The values a new record may start on. The field's `default`, when it has one, must be among them.",
        defaultNote: 'any option',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  allow: Schema.Array(TransitionStepSchema).pipe(
    Schema.annotate({
      description:
        'The moves the field may make. A change that no entry allows is refused; a write that keeps the value passes.',
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  message: Schema.optional(BusinessRuleMessageSchema),
  exemptRoles: Schema.optional(BusinessRuleExemptRolesSchema),
}).pipe(
  Schema.annotate({
    identifier: 'TransitionRule',
    title: 'Transition Rule',
    description:
      'The moves a `single-select` or `status` field may make, from the value it holds to the value a write sends. A write that leaves the field unchanged passes; on a create, the value must be one of `initial` when it is declared.',
  })
)

export type TransitionRule = Schema.Schema.Type<typeof TransitionRuleSchema>
