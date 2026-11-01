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
 * A lock: while the STORED record matches `when`, the fields it names keep
 * their value, and the record may be kept from deletion.
 *
 * Judged on the row as it is stored, before the write. A write that sends a
 * locked field its current value passes — a form re-posts every field — and a
 * write that changes it is refused with `message`. A lock never applies to a
 * create: a record that does not exist yet has no stored state to lock.
 *
 * Which fields `fields` and `except` may name is judged with the table's
 * fields (`business-rule-validation.ts`).
 *
 * @example
 * ```yaml
 * - name: invoice-frozen-once-validated
 *   kind: lock
 *   when: { field: status, operator: in, value: [validated, paid] }
 *   fields: [number, amount, customer]
 *   message: "The invoice number can't change after validation."
 * ```
 */
export const LockRuleSchema = Schema.Struct({
  name: BusinessRuleNameSchema,
  kind: Schema.Literal('lock').annotate({
    description:
      'A lock keeps fields from changing, and optionally the record from being deleted, while the stored record matches `when`.',
  }),
  when: RowLevelWhenSchema,
  fields: Schema.optional(
    Schema.Array(
      Schema.String.pipe(
        Schema.annotate({ description: 'A field the lock keeps from changing.' }),
        Schema.check(Schema.isMinLength(1))
      )
    ).pipe(
      Schema.annotate({
        description:
          'The fields the lock keeps from changing. Each must be a field of the table a caller can write: not a system field, not a computed one.',
        defaultNote: 'every field a caller can write, less `except`',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  except: Schema.optional(
    Schema.Array(
      Schema.String.pipe(
        Schema.annotate({ description: 'A field left free while the record is locked.' }),
        Schema.check(Schema.isMinLength(1))
      )
    ).pipe(
      Schema.annotate({
        description:
          'The fields left free while the record is locked, when `fields` is left out: the field that unlocks the record, typically. Cannot be combined with `fields`.',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  blocks: Schema.optional(
    Schema.Array(
      Schema.Literals(['update', 'delete']).annotate({
        description:
          'An operation the lock refuses: `update` changing a locked field, `delete` deleting a locked record.',
      })
    ).pipe(
      Schema.annotate({
        description:
          'What the lock refuses on a locked record: `update` a change to a locked field, `delete` deleting the record. A lock never refuses a create.',
        defaultNote: '[update]',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  message: Schema.optional(BusinessRuleMessageSchema),
  exemptRoles: Schema.optional(BusinessRuleExemptRolesSchema),
}).pipe(
  Schema.annotate({
    identifier: 'LockRule',
    title: 'Lock Rule',
    description:
      'Keeps fields from changing, and optionally the record from being deleted, while the stored record matches `when`: a field, an operator and a literal value, or an `and`/`or` group of them. A field of the row a many-to-one relationship points to is written `<relationship>.<field>`. A rule describes data, not the caller, so a `$currentUser` value is refused. A write that resends a locked field its current value passes. Without a `message`, the refusal reads "<Label> can no longer be changed.", naming the field by its `label` or, without one, by its column name made readable (`due_date` reads "Due date"); a lock naming neither `fields` nor `except`, and a refused delete, read "This record can no longer be changed."',
  })
)

export type LockRule = Schema.Schema.Type<typeof LockRuleSchema>
