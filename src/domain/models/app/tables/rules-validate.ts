/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { RowLevelWhenSchema } from './row-level-permissions'
import {
  BusinessRuleExemptRolesSchema,
  BusinessRuleMessageSchema,
  BusinessRuleNameSchema,
} from './rules-base'

/**
 * A validation: a condition the record must meet once the write is applied.
 *
 * Judged on the record as it would be stored — the stored row with the write
 * applied on an update, the new row on a create. When `if` is declared, the
 * rule applies only to a record that matches it. A value computed from other
 * records (a count of lines, a total) is read through the table's `count` or
 * `rollup` field. `message` is required: a validation has no default wording
 * that could say what the author meant.
 *
 * @example
 * ```yaml
 * - name: validated-needs-lines
 *   kind: validate
 *   if: { field: status, operator: eq, value: validated }
 *   require: { field: line_count, operator: neq, value: 0 }
 *   message: A validated invoice needs at least one line.
 * ```
 */
export const ValidateRuleSchema = Schema.Struct({
  name: BusinessRuleNameSchema,
  kind: Schema.Literal('validate').annotate({
    description: 'A validation refuses a write after which the record would not meet `require`.',
  }),
  on: Schema.optional(
    Schema.Array(
      Schema.Literals(['create', 'update']).annotate({
        description: 'A write the validation judges: `create` a new record, `update` a change.',
      })
    ).pipe(
      Schema.annotate({
        description: 'Which writes the validation judges.',
        defaultNote: '[create, update]',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  if: Schema.optional(RowLevelWhenSchema),
  require: RowLevelWhenSchema,
  message: BusinessRuleMessageSchema,
  exemptRoles: Schema.optional(BusinessRuleExemptRolesSchema),
}).pipe(
  Schema.annotate({
    identifier: 'ValidateRule',
    title: 'Validate Rule',
    description:
      'A condition, `require`, the record must meet once the write is applied, judged on the record as it would be stored. With `if`, it applies only to a record that matches `if` after the write. Both take the grammar of `when`; a value computed from other records is read through a `count` or `rollup` field. `message` is required.',
  })
)

export type ValidateRule = Schema.Schema.Type<typeof ValidateRuleSchema>
