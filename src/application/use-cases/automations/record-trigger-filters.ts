/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { COMPARATORS } from '@/domain/services/automations/comparison-operators'
import { resolveTriggerInString } from './resolve-trigger-data'
import type { ConditionGroup } from '@/domain/models/app/automations/conditions'

/**
 * Trigger-time condition evaluation for record triggers.
 *
 * The IMPURE half of record-trigger conditions: resolving a condition's `field`
 * against the triggering record, which needs the template engine. The pure
 * half — the operator semantics — is {@link COMPARATORS} in
 * `@/domain/services/automations/comparison-operators`, shared verbatim with
 * `filter/continue` and `path/branch` so any schema-valid condition means the
 * same thing wherever it is written.
 *
 * That table covers the full ConditionGroup operator set defined in
 * `src/domain/models/app/automations/conditions.ts`. Coverage was widened from
 * the original T-3 canary subset (8 ops) to all 15 operators after a T-3 R-3
 * review flagged silent "schema-valid but never fires" drift on the missing
 * comparators.
 *
 * Condition `field` may be either a literal column name or a template
 * variable. Two template shapes are supported, matching the spec authoring
 * conventions in `record.spec.ts`:
 *   - `{{record.<field>}}`            ← preferred (record-trigger context)
 *   - `{{trigger.data.record.<field>}}` ← canonical engine context
 */

/**
 * Resolve a condition's `field` against the record context. A template
 * variable (`{{record.X}}`) substitutes the record value; a literal name
 * is read as a column lookup — same semantic as the action-handler filter
 * in `record.ts`'s `extractIdFromFilter`.
 */
const resolveLhs = (field: string, record: Readonly<Record<string, unknown>>): unknown => {
  const ctx = { record, trigger: { data: { record } } }
  const resolved = resolveTriggerInString(field, ctx)
  return resolved === field ? record[field] : resolved
}

const evaluateOne = (
  field: string,
  operator: string,
  expected: unknown,
  record: Readonly<Record<string, unknown>>
): boolean => {
  const compare = COMPARATORS[operator]
  // Unknown operator: fail closed. A future migration spec can extend
  // operator coverage; until then, an unrecognised operator should NOT
  // silently become "true" — that would over-fire the trigger.
  if (compare === undefined) return false
  return compare(resolveLhs(field, record), expected)
}

/**
 * Evaluate a ConditionGroup against the given record.
 *
 * Logic defaults to `and` (all conditions must match), matching the schema's
 * documented default. `or` short-circuits on the first match.
 */
export const evaluateRecordTriggerCondition = (
  group: ConditionGroup,
  record: Readonly<Record<string, unknown>>
): boolean => {
  const logic = group.logic ?? 'and'
  if (logic === 'or') {
    return group.conditions.some((c) => evaluateOne(c.field, c.operator, c.value, record))
  }
  return group.conditions.every((c) => evaluateOne(c.field, c.operator, c.value, record))
}
