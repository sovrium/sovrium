/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { transformRecord } from '@/application/use-cases/tables/record-transformer'
import { isAutomationOperationallyEnabled } from '@/domain/models/app/automations/automation-operational-state'
import { COMPARATORS } from '@/domain/models/app/automations/comparison-operators'
import {
  firstMatchingTrigger,
  type TriggerOfType,
} from '@/domain/models/app/automations/trigger-entries-service'
import { resolveTriggerInString } from './resolve-trigger-data'
import type { TemplateRenderer } from '@/application/ports/services/template-engine'
import type { App } from '@/domain/models/app'
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
 * variable. The template shapes supported match the spec authoring
 * conventions in `record.spec.ts`:
 *   - `{{record.<field>}}`                    ← preferred (record-trigger context)
 *   - `{{trigger.data.record.<field>}}`         ← canonical engine context
 *   - `{{trigger.data.previousRecord.<field>}}` ← the row before an update
 *     (also `{{previousRecord.<field>}}`); empty on create and delete, where
 *     there is no previous row
 */

/** The row after the event, and the row before it when the event is an update. */
interface ConditionRows {
  readonly record: Readonly<Record<string, unknown>>
  readonly previousRecord: Readonly<Record<string, unknown>> | undefined
  readonly templates: TemplateRenderer
}

/**
 * Resolve a condition's `field` against the record context. A template
 * variable (`{{record.X}}`) substitutes the record value; a literal name
 * is read as a column lookup — same semantic as the action-handler filter
 * in `record.ts`'s `extractIdFromFilter`.
 */
const resolveLhs = (field: string, rows: ConditionRows): unknown => {
  const { record, previousRecord, templates } = rows
  const data = previousRecord === undefined ? { record } : { record, previousRecord }
  const ctx = { ...data, trigger: { data } }
  const resolved = resolveTriggerInString(field, ctx, templates)
  return resolved === field ? record[field] : resolved
}

const evaluateOne = (
  field: string,
  operator: string,
  expected: unknown,
  rows: ConditionRows
): boolean => {
  const compare = COMPARATORS[operator]
  // Unknown operator: fail closed. A future migration spec can extend
  // operator coverage; until then, an unrecognised operator should NOT
  // silently become "true" — that would over-fire the trigger.
  if (compare === undefined) return false
  return compare(resolveLhs(field, rows), expected)
}

/**
 * Evaluate a ConditionGroup against the row after the event and, for an
 * update, the row before it — so a condition can name a transition ("now paid,
 * and not paid before") rather than only a state.
 *
 * Logic defaults to `and` (all conditions must match), matching the schema's
 * documented default. `or` short-circuits on the first match.
 */
export const evaluateRecordTriggerCondition = (
  templates: TemplateRenderer,
  group: ConditionGroup,
  record: Readonly<Record<string, unknown>>,
  previousRecord?: Readonly<Record<string, unknown>>
): boolean => {
  const rows: ConditionRows = { record, previousRecord, templates }
  const logic = group.logic ?? 'and'
  if (logic === 'or') {
    return group.conditions.some((c) => evaluateOne(c.field, c.operator, c.value, rows))
  }
  return group.conditions.every((c) => evaluateOne(c.field, c.operator, c.value, rows))
}

/**
 * Whether at least one of `watchFields` differs between the record before an
 * update and after it — the gate that narrows an update trigger to the columns
 * it watches.
 *
 * Both sides are read through the records API's own typing first. The two rows
 * seldom arrive in one shape: the previous row is read raw (a PostgreSQL
 * `numeric` is the string `'1'`) while the written one has been typed (`1`), so
 * a raw comparison saw every numeric watched field as changed — and a record
 * automation whose own write touched another column re-fired itself until the
 * loop limit stopped it.
 *
 * No `previousRecord` (create/delete, or a previous row that could not be read)
 * cannot be diffed and fails open: the trigger fires.
 */
export const watchFieldsChanged = (input: {
  readonly app: App
  readonly tableName: string
  readonly watchFields: readonly string[]
  readonly record: Readonly<Record<string, unknown>>
  readonly previousRecord: Readonly<Record<string, unknown>> | undefined
}): boolean => {
  const { app, tableName, watchFields, record, previousRecord } = input
  if (previousRecord === undefined) return true
  const typed = (row: Readonly<Record<string, unknown>>) =>
    transformRecord(row, { app, tableName }).fields as Readonly<Record<string, unknown>>
  const before = typed(previousRecord)
  const after = typed(record)
  return watchFields.some((field) => {
    // `!==` settles primitives; JSON settles an object-valued field. A
    // pragmatic safety net for the scalar columns watched in practice, not a
    // deep-equality contract.
    if (before[field] === after[field]) return false
    return JSON.stringify(before[field]) !== JSON.stringify(after[field])
  })
}

export interface RecordEventMatchInput {
  readonly app: App
  readonly tableName: string
  readonly event: 'create' | 'update' | 'delete' | 'restore'
  readonly record: Record<string, unknown>
  readonly previousRecord: Record<string, unknown> | undefined
  readonly pausedNames: ReadonlySet<string>
  readonly templates: TemplateRenderer
}

/**
 * The record-triggered automations the event starts, each with the record
 * entry it matched: the (tableName, event) tuple AND, for `update` events, the
 * `watchFields`/`condition` gates if configured. An automation starts once per
 * event, under the first of its record entries that matches. Automations that
 * are OFF — config-disabled OR operationally paused — are excluded, so an
 * operator can stop a misbehaving workflow without editing config.
 */
export const findMatchingRecordAutomations = (
  input: RecordEventMatchInput
): readonly RecordMatch[] =>
  (input.app.automations ?? []).flatMap((automation) => {
    if (!isAutomationOperationallyEnabled(automation, input.pausedNames)) return []
    const trigger = firstMatchingTrigger(automation, 'record', (entry) =>
      recordEntryMatches(entry, input)
    )
    return trigger === undefined ? [] : [{ automation, trigger }]
  })

/** An automation the event starts, with the record entry that starts it. */
export interface RecordMatch {
  readonly automation: NonNullable<App['automations']>[number]
  readonly trigger: TriggerOfType<'record'>
}

/** Whether one record entry matches the event, its gates included. */
const recordEntryMatches = (
  trigger: TriggerOfType<'record'>,
  input: RecordEventMatchInput
): boolean => {
  const { app, tableName, event, record, previousRecord, templates } = input
  if (trigger.table !== tableName) return false
  if (!trigger.events.includes(event)) return false
  // watchFields narrows update events to specific columns. Create/delete
  // ignore watchFields per the schema convention (the column "doesn't
  // exist before/after" semantics are undefined).
  if (
    event === 'update' &&
    trigger.watchFields !== undefined &&
    !watchFieldsChanged({
      app,
      tableName,
      watchFields: trigger.watchFields,
      record,
      previousRecord,
    })
  ) {
    return false
  }
  // condition filters by record content. Evaluated against a context
  // exposing the new record at both `record.X` and `trigger.data.record.X`
  // so spec authors can pick the more readable variant — and, on an update,
  // the row before it at `trigger.data.previousRecord.X`, so a condition can
  // name a transition rather than a state.
  if (
    trigger.condition !== undefined &&
    !evaluateRecordTriggerCondition(templates, trigger.condition, record, previousRecord)
  ) {
    return false
  }
  return true
}
