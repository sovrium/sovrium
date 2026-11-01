/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { LockRuleSchema } from './rules-lock'
import { TransitionRuleSchema } from './rules-transition'
import { ValidateRuleSchema } from './rules-validate'

/**
 * The business rules of a table: what makes a record write valid, beyond what
 * its fields accept on their own.
 *
 * Permissions answer WHO may write, with a `404` to anyone they leave out.
 * Rules answer WHAT may be written, with a `400` carrying the rule's message,
 * and they bind every caller — an admin, an automation, the AI chat and the
 * MCP tools included — but the roles a rule names in `exemptRoles`. Every rule
 * of the table is judged on each write, and every rule broken is reported.
 *
 * Three kinds:
 *
 *  - `lock` keeps fields, or the whole record, from changing while the stored
 *    record matches a condition ({@link LockRuleSchema});
 *  - `transition` lists the moves a one-of field may make
 *    ({@link TransitionRuleSchema});
 *  - `validate` states a condition the record must meet after the write
 *    ({@link ValidateRuleSchema}).
 *
 * What each rule may name is judged with the table's fields
 * (`business-rule-validation.ts`).
 */
export const BusinessRuleSchema = Schema.Union([
  LockRuleSchema,
  TransitionRuleSchema,
  ValidateRuleSchema,
]).pipe(
  Schema.annotate({
    identifier: 'BusinessRule',
    title: 'Business Rule',
    description:
      'One rule a record write must keep: a `lock`, a `transition` or a `validate`, told apart by `kind`.',
  })
)

export type BusinessRule = Schema.Schema.Type<typeof BusinessRuleSchema>

export const TableRulesSchema = Schema.Array(BusinessRuleSchema).pipe(
  Schema.annotate({
    identifier: 'TableRules',
    title: 'Business Rules',
    description:
      "The rules a record write to this table must keep. A write that breaks one is refused with `400` and the rule's message, whoever makes it (an admin, an automation, the AI chat and the MCP tools included), unless their role is in the rule's `exemptRoles`. `sovrium seed` writes without them.",
  })
)

export type TableRules = Schema.Schema.Type<typeof TableRulesSchema>
