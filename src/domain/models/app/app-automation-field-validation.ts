/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { flattenActions } from './automations/step-read-service'
import { entriesOfType } from './automations/trigger-entries-service'
import { isResolvableColumnName } from './tables/system-fields'
import type { Automations } from './automations'
import type { Tables } from './tables'

/**
 * Every COLUMN an automation names must exist on the table it names: a record
 * trigger's `watchFields` and condition fields, and a record action's filter,
 * sort, selection and match fields. Each function is the body of one `AppSchema`
 * filter, with the same messages, kept beside `app.ts` so the schema reads as a
 * list. An unknown TABLE is the table rule's verdict
 * (`validateAutomationTableReferences`), never reported here a second time.
 */

/**
 * Whether a config value is resolved at RUN time, leaving no name to check
 * statically.
 *
 * The predicate is deliberately the runtime's own — `resolveTriggerInString`
 * fast-paths on `!input.includes('{{')`. A validator that decides "is this a
 * template?" differently from the engine that expands it is how the two come to
 * reach opposite verdicts on one config.
 */
const isRuntimeResolvedValue = (value: string): boolean =>
  value.includes('{{') || value.startsWith('$env.')

/**
 * How a record action's config named a column, phrased for the refusal message.
 *
 * The verb carries real information: an author who mistyped a column now has
 * THREE candidate surfaces to go and look at, and "'knid' does not exist" alone
 * does not say which. `filters on` is byte-identical to what shipped and must
 * stay so — two E2E criteria assert that sentence verbatim.
 */
type ColumnRefKind = 'filters on' | 'sorts on' | 'selects'

interface ColumnRef {
  readonly field: string
  readonly kind: ColumnRefKind
}

/**
 * Every prop on a record action that names a column: the condition fields of
 * `filter` (update / delete / upsert / batchDelete), the `sort` keys and
 * `fields` selection of `list`, and `batchUpsert`'s `matchField`.
 *
 * `sort` joined this set with the `record.read` split's `record/list`, and it is the WORSE of
 * the filter/sort pair. An unknown filter field returns a visibly wrong row set;
 * an unknown sort key returns the right rows in an arbitrary order and reports
 * success — on SQLite the quoted unknown name resolves to a string constant, so
 * every row sorts by the same value and no reordering happens at all. Combined
 * with a `limit` that is an arbitrary page, delivered as if it were the top N.
 *
 * `fields` is here for a DIFFERENT reason, and the distinction is worth stating
 * because it decides what this rule is for. Unlike the other three it does NOT
 * reach SQL: an automation's `fields` is a payload trim applied in memory to
 * rows already fetched, so no identifier is ever emitted and no dialect can
 * misread one. It earns the check by being the quietest of the four — a typo
 * yields rows without that key, every `{{…records.0.tittle}}` downstream
 * expands to nothing, and the run reports success with no error anywhere. This
 * rule is about names that do not exist, not solely about SQL injection
 * surfaces.
 *
 * `record/read` left this set in the same change: since the `record.read` split it is
 * primary-key-only and has no author-supplied identifier left to adjudicate.
 *
 * `batchUpdate` is absent by nature, not by omission — its per-item filters
 * arrive inside a `{{...}}` template and do not exist at config time.
 */
const recordActionColumnRefs = (props: Readonly<Record<string, unknown>>): readonly ColumnRef[] => {
  const { filter, matchField, sort, fields } = props as {
    readonly filter?: unknown
    readonly matchField?: unknown
    readonly sort?: unknown
    readonly fields?: unknown
  }
  const conditions =
    filter && typeof filter === 'object'
      ? (filter as { readonly conditions?: unknown }).conditions
      : undefined
  const conditionRefs: readonly ColumnRef[] = Array.isArray(conditions)
    ? conditions.flatMap((condition) => {
        if (!condition || typeof condition !== 'object') return []
        const { field } = condition as { readonly field?: unknown }
        return typeof field === 'string' ? [{ field, kind: 'filters on' as const }] : []
      })
    : []
  // `matchField` keeps the FILTER wording deliberately: it is `batchUpsert`'s
  // equivalent of a filter condition, and a third verb for it would say the
  // same thing in one more voice.
  const matchRefs: readonly ColumnRef[] =
    typeof matchField === 'string' ? [{ field: matchField, kind: 'filters on' as const }] : []
  const sortRefs: readonly ColumnRef[] = Array.isArray(sort)
    ? sort.flatMap((key) => {
        if (!key || typeof key !== 'object') return []
        const { field } = key as { readonly field?: unknown }
        return typeof field === 'string' ? [{ field, kind: 'sorts on' as const }] : []
      })
    : []
  // `record/create` and `record/update` also carry a `fields` prop, but theirs
  // is a WRITE PAYLOAD — an object keyed by column name — while `list`'s is an
  // array of names. Reading only the array shape is what keeps this from
  // adjudicating the wrong prop on the wrong operator without needing to switch
  // on `operator` here.
  const selectionRefs: readonly ColumnRef[] = Array.isArray(fields)
    ? fields.flatMap((name) =>
        typeof name === 'string' ? [{ field: name, kind: 'selects' as const }] : []
      )
    : []
  return [...conditionRefs, ...matchRefs, ...sortRefs, ...selectionRefs]
}

/**
 * A record trigger's `watchFields` name fields of the table it watches.
 *
 * Pure; `AppSchema` runs it as one of its `Schema.check` filters, so its
 * message is the decode error a refused config prints.
 */
export const validateRecordTriggerWatchFields = (app: {
  readonly automations?: Automations | undefined
  readonly tables?: Tables | undefined
}): true | string => {
  if (!app.automations || !app.tables) return true

  const tableFieldMap = new Map(
    app.tables.map((t) => [t.name, new Set(t.fields.map((f) => f.name))])
  )

  const watchFieldError = entriesOfType(app.automations, 'record')
    .flatMap(({ automation, trigger }) => {
      const tableFields = tableFieldMap.get(trigger.table)
      if (!trigger.watchFields || !tableFields) return []
      return trigger.watchFields
        .filter((field) => !tableFields.has(field))
        .map((field) => ({ automation, field, table: trigger.table }))
    })
    .at(0)

  if (watchFieldError) {
    return `Automation '${watchFieldError.automation}' watchField '${watchFieldError.field}' does not exist in table '${watchFieldError.table}'`
  }
  return true
}

/**
 * Automation cross-validation: record trigger condition fields must reference
 * existing fields.
 *
 * A record trigger has TWO field-name surfaces and only `watchFields` was
 * checked. `trigger.condition[].field` never becomes a SQL identifier —
 * `evaluateRecordTriggerCondition` resolves it in memory against the event's
 * record — so there is no mass-deletion path and no dialect asymmetry here.
 * The silence is worse instead, because it runs in BOTH directions and
 * neither leaves a trace: `isEmpty`/`isNull` answer on the VALUE alone, so a
 * name resolving to `undefined` reads as "empty" and the automation OVER-fires
 * on every event as though no condition had been written, while
 * `isNotEmpty`/`isNotNull` invert that and the automation NEVER fires. The
 * second direction produces no failed run, no error and no log line at all —
 * boot is the last place it is still observable.
 *
 * The two exemptions are the record-action rule's, for the same reasons: a
 * `{{...}}` field is only knowable at run time, and system columns exist
 * without appearing in `fields[]`.
 *
 * Pure; `AppSchema` runs it as one of its `Schema.check` filters, so its
 * message is the decode error a refused config prints.
 */
export const validateRecordTriggerConditionFields = (app: {
  readonly automations?: Automations | undefined
  readonly tables?: Tables | undefined
}): true | string => {
  if (!app.automations || !app.tables) return true

  const tableFieldMap = new Map(
    app.tables.map((t) => [t.name, new Set(t.fields.map((f) => f.name))])
  )

  const conditionFieldError = entriesOfType(app.automations, 'record')
    .flatMap(({ automation, trigger: entry }) => {
      const trigger = entry as {
        readonly table: string
        readonly condition?: { readonly conditions?: readonly { readonly field?: unknown }[] }
      }
      const tableFields = tableFieldMap.get(trigger.table)
      // An unknown table is the TABLE rule's verdict, not this one's.
      if (!tableFields) return []
      return (trigger.condition?.conditions ?? [])
        .flatMap((condition) => (typeof condition.field === 'string' ? [condition.field] : []))
        .filter((field) => !isRuntimeResolvedValue(field))
        .filter((field) => !isResolvableColumnName(tableFields, field))
        .map((field) => ({ automation, field, table: trigger.table }))
    })
    .at(0)

  if (conditionFieldError) {
    return `Automation '${conditionFieldError.automation}' trigger condition field '${conditionFieldError.field}' does not exist in table '${conditionFieldError.table}'`
  }
  return true
}

/**
 * Automation cross-validation: record-action column references must name real
 * columns.
 *
 * A record action's `filter.conditions[].field`, `batchUpsert.matchField` and
 * `list.sort[].field` become SQL IDENTIFIERS, and the two dialects disagree
 * about an unknown one in the worst possible direction. Postgres raises 42703
 * and the action fails closed. SQLite — the zero-config DEFAULT engine —
 * resolves a double-quoted name that matches no column to a string LITERAL,
 * so `"knid" <> 'zzz'` compares the constant 'knid' against 'zzz' on every
 * row and the predicate matches the WHOLE TABLE. Whether that happens turns
 * on the OPERAND, not the operator: `equals 'knid'` and `contains 'ni'` are
 * tautologies while `equals 'alpha'` fails closed, so no subset of operators
 * is safe to exempt. On a `record/delete` that is a silent mass-deletion
 * reported as success.
 *
 * A `sort` key degrades differently and no less quietly: `ORDER BY "knid"`
 * orders every row by that same string constant, so the rows come back in an
 * arbitrary order with a SUCCESSFUL run and nothing saying the ordering was
 * never applied — and under a `limit` that arbitrary order picks the page.
 *
 * Catching the typo here means it never reaches SQL, and `sovrium validate`
 * reports it without booting. It cannot cover every case — see the two
 * deliberate skips below and `batchUpdate`, whose per-item filters arrive
 * inside a `{{...}}` template and do not exist at config time at all.
 *
 * Pure; `AppSchema` runs it as one of its `Schema.check` filters, so its
 * message is the decode error a refused config prints.
 */
export const validateRecordActionColumnReferences = (app: {
  readonly automations?: Automations | undefined
  readonly tables?: Tables | undefined
}): true | string => {
  if (!app.automations || !app.tables) return true

  const tableFieldMap = new Map(
    app.tables.map((t) => [t.name, new Set(t.fields.map((f) => f.name))])
  )

  const filterFieldError = app.automations
    .flatMap((a) =>
      flattenActions(a.actions)
        .filter((action) => action.type === 'record')
        .flatMap((action) => {
          const props = action.props as Record<string, unknown>
          const { table } = props as { readonly table?: unknown }
          if (typeof table !== 'string') return []
          const tableFields = tableFieldMap.get(table)
          // An unknown table is the TABLE rule's verdict. Reporting it here
          // too would say the same thing twice in two voices.
          if (!tableFields) return []
          return (
            recordActionColumnRefs(props)
              .filter((ref) => !isRuntimeResolvedValue(ref.field))
              // System columns (`id`, the timestamps, the authorship columns)
              // exist without appearing in `fields[]`. Every record filter in
              // `apps/partner` targets `field: 'id'`, so omitting this exemption
              // would refuse to boot three shipped automations. The predicate is
              // SHARED with the runtime check in `record-filters.ts` so the two
              // halves cannot reach opposite verdicts on the same name.
              .filter((ref) => !isResolvableColumnName(tableFields, ref.field))
              .map((ref) => ({
                automation: a.name,
                action: action.name,
                field: ref.field,
                kind: ref.kind,
                table,
                declared: [...tableFields],
              }))
          )
        })
    )
    .at(0)

  if (filterFieldError) {
    return `Automation '${filterFieldError.automation}' record action '${filterFieldError.action}' ${filterFieldError.kind} field '${filterFieldError.field}' which does not exist in table '${filterFieldError.table}'. Available: ${filterFieldError.declared.join(', ')}`
  }
  return true
}
