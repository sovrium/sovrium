/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a table's business rules (`tables[].rules`) say about one write, and
 * what they keep a reader from changing on one stored record.
 *
 * A rule binds every caller — an admin, the top role, an automation included —
 * but the roles it names in `exemptRoles`. So a predicate is judged with
 * {@link evaluateRecordAgainstPredicate} directly, never through the row
 * rules' `rowPassesRule`, whose unrestricted caller passes every rule.
 *
 *  - a `lock` is judged on the STORED row: it refuses a change to a locked
 *    field whose value differs from the stored one (a form re-posts unchanged
 *    values), and, with `blocks: [delete]`, deleting the row; never a create;
 *  - a `transition` judges the move `(stored value, sent value)`; a write that
 *    leaves the field out or keeps its value passes; a create starts on one of
 *    `initial` when it is declared;
 *  - a `validate` judges the row as it would be stored: the stored row with the
 *    change laid over it, or the created row with its defaults.
 *
 * Values are compared by the field's type: PostgreSQL hands a count or a
 * decimal back as text (`"0"`, `"1250.00"`) where SQLite hands a number, and a
 * rule must answer the same on both engines.
 */

import { CHECKBOX_FIELD_TYPES, checkboxLiteralOf, fieldLiteralOf } from './checkbox-literal-service'
import { isFieldReadableByCaller } from './field-read-filter-service'
import { isReadonlyComputedFieldType } from './fields/field'
import { isPredicateGroup, evaluateRecordAgainstPredicate } from './row-level-evaluator-service'
import { rowAsCreated, rowAsWritten } from './row-level-write-decision-service'
import { isRowRuleChain, lookupLeavesOf, parseRowRuleChain } from './row-rule-chain-service'
import { isSystemFieldName } from './system-fields'
import type { CurrentUserContext } from './row-level-evaluator-service'
import type { RowLevelPredicate, RowLevelWhen } from './row-level-permissions'
import type { BusinessRule, TableRules } from './rules'
import type { LockRule } from './rules-lock'
import type { TransitionRule } from './rules-transition'
import type { ValidateRule } from './rules-validate'
import type { App } from '@/domain/models/app'

type Row = Readonly<Record<string, unknown>>

type AppTable = NonNullable<App['tables']>[number]

/**
 * A stored row as a restore is judged on: out of the trash, as it will stand
 * once restored; `undefined` for a row that is not in the trash, which the
 * restore itself answers. The one definition both the early judgement and the
 * one inside the restore's transaction read, so the two cannot disagree.
 */
export const rowAsRestored = (row: Row | null | undefined): Row | undefined => {
  if (row === undefined || row === null) return undefined
  if (row['deleted_at'] === undefined || row['deleted_at'] === null) return undefined
  // eslint-disable-next-line unicorn/no-null -- SQL NULL is the stored value a restore leaves in the trash columns
  return { ...row, deleted_at: null, ...('deleted_by' in row ? { deleted_by: null } : {}) }
}

/** One rule a write broke: its name, the field it is about when there is one, the message. */
export interface RuleViolation {
  readonly rule: string
  readonly field?: string
  readonly message: string
}

/** Who writes or reads: the role decides `exemptRoles`, the groups a field read grant. */
export interface RuleWriter {
  readonly userId: string
  readonly role?: string
  readonly groups?: readonly string[]
}

/**
 * One write as the rules judge it. A `restore` brings a record back from the
 * trash and is judged as an update that changes no field: a lock blocking
 * `delete` refuses it while the row matches, as it refuses the delete; a
 * validation judging updates refuses a row that breaks it; a transition never
 * does, nor a lock on fields, since no field moves.
 */
export interface RuleJudgement {
  readonly op: 'create' | 'update' | 'delete' | 'restore'
  /** The row as it stands (empty on a create; on a restore, as it will stand once restored). */
  readonly existing: Row
  /** The fields the write sends (empty on a delete). */
  readonly change: Row
  readonly ctx: CurrentUserContext
}

/** The `_locks` block of a record read. */
export interface LocksBlock {
  readonly fields: readonly string[] | '*'
  readonly delete?: true
  /** The message a delete would be refused with, beside `delete`. */
  readonly deleteReason?: string
  readonly next?: Readonly<Record<string, readonly string[]>>
  readonly reasons?: Readonly<Record<string, string>>
}

const ANY_VALUE = '*'

/** Field types whose stored value is a number, whatever text a driver returns it as. */
const NUMERIC_FIELD_TYPES: ReadonlySet<string> = new Set([
  'integer',
  'decimal',
  'currency',
  'percentage',
  'percent',
  'number',
  'rating',
  'progress',
  'duration',
  'count',
  'rollup',
  'autonumber',
])

/** Field types no caller writes, so a lock that covers "every field" leaves them out. */
const UNWRITTEN_FIELD_TYPES: ReadonlySet<string> = new Set([
  'created-at',
  'updated-at',
  'deleted-at',
  'created-by',
  'updated-by',
  'deleted-by',
  'button',
])

const tableOf = (app: App, tableName: string): AppTable | undefined =>
  app.tables?.find((table) => table.name === tableName)

/** The rules a table declares, none when it declares none. */
export const rulesOf = (table: { readonly rules?: TableRules } | undefined) => table?.rules ?? []

/** Whether `tableName` declares any rule a write could break. */
export const tableDeclaresRules = (app: App, tableName: string): boolean =>
  rulesOf(tableOf(app, tableName)).length > 0

/**
 * The context a rule is judged in: the writer or reader by id and role, and
 * nothing a rule could read about her — a rule describes data, so a
 * `$currentUser` value is refused in its config and no account is looked up.
 */
export const bareRuleContext = (userId: string, role: string | undefined): CurrentUserContext => ({
  userId,
  email: undefined,
  role: role ?? '',
  isUnrestricted: false,
  assignments: new Map(),
})

/**
 * `locks` with each reason as its reader is told it, through `translate` — the
 * app's `$t:` translator, which this slug may not reach itself.
 */
export const translatedLocks = (
  locks: LocksBlock,
  translate: (text: string) => string
): LocksBlock =>
  locks.reasons === undefined && locks.deleteReason === undefined
    ? locks
    : {
        ...locks,
        ...(locks.deleteReason === undefined
          ? {}
          : { deleteReason: translate(locks.deleteReason) }),
        ...(locks.reasons === undefined
          ? {}
          : {
              reasons: Object.fromEntries(
                Object.entries(locks.reasons).map(([field, reason]) => [field, translate(reason)])
              ),
            }),
      }

/** Whether `role` is one the rule does not bind. */
const exempts = (rule: BusinessRule, role: string | undefined): boolean =>
  role !== undefined && (rule.exemptRoles ?? []).includes(role)

/** Every leaf of a predicate. */
const leavesOf = (when: RowLevelWhen | undefined): readonly RowLevelPredicate[] => {
  if (when === undefined) return []
  return isPredicateGroup(when) ? when.conditions.flatMap(leavesOf) : [when]
}

/** The predicates a rule judges. */
const whensOfRule = (rule: BusinessRule): readonly RowLevelWhen[] => {
  if (rule.kind === 'lock') return [rule.when]
  if (rule.kind === 'validate')
    return rule.if === undefined ? [rule.require] : [rule.if, rule.require]
  return []
}

/** The predicates of a table's rules: the leaves a chain loader must pre-load. */
export const ruleWhensOf = (table: AppTable | undefined): readonly RowLevelWhen[] =>
  rulesOf(table).flatMap(whensOfRule)

/** Whether a rule reads another record (a relationship hop, a membership). */
const ruleNeedsLookups = (rule: BusinessRule): boolean =>
  whensOfRule(rule).some((when) => lookupLeavesOf(when).length > 0)

/** Whether judging the table's rules reads another record. */
export const rulesNeedLookups = (table: AppTable | undefined): boolean =>
  rulesOf(table).some(ruleNeedsLookups)

/** The columns of the ruled row the rules read: their predicates, locked and moved fields. */
export const ruleColumnsOf = (table: AppTable | undefined): readonly string[] => {
  const columns = rulesOf(table).flatMap((rule) => [
    ...whensOfRule(rule)
      .flatMap(leavesOf)
      .map((leaf) =>
        isRowRuleChain(leaf.field) ? (parseRowRuleChain(leaf.field)?.relation ?? '') : leaf.field
      ),
    ...(rule.kind === 'lock' ? (rule.fields ?? []) : []),
    ...(rule.kind === 'transition' ? [rule.field] : []),
  ])
  return [...new Set(columns.filter((column) => column.length > 0))]
}

/** Whether a value stands for "nothing stored". */
const isEmpty = (value: unknown): boolean => value === undefined || value === null || value === ''

/** A number-typed value as a number, when it reads as one. */
const asNumber = (value: unknown): unknown => {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : value
}

/** A stored or sent value in one form per field type, so both engines compare alike. */
const normalized = (type: string | undefined, value: unknown): unknown => {
  if (isEmpty(value)) return undefined
  if (value instanceof Date) return value.toISOString()
  if (type !== undefined && NUMERIC_FIELD_TYPES.has(type)) return asNumber(value)
  if (type !== undefined && CHECKBOX_FIELD_TYPES.has(type)) return checkboxLiteralOf(value) === true
  return typeof value === 'object' ? JSON.stringify(value) : value
}

const fieldTypeOf = (table: AppTable, name: string): string | undefined =>
  table.fields.find((field) => field.name === name)?.type

/** Whether a value sent for `name` equals the one stored. */
const sameValue = (table: AppTable, name: string, stored: unknown, sent: unknown): boolean => {
  const type = fieldTypeOf(table, name)
  const [a, b] = [normalized(type, stored), normalized(type, sent)]
  if (a === b) return true
  if (a === undefined || b === undefined) return false
  if (type === 'date' && typeof a === 'string' && typeof b === 'string') {
    return a.slice(0, 10) === b.slice(0, 10)
  }
  return String(a) === String(b)
}

/**
 * A row as the predicates compare it: every numeric column as a number, and
 * every checkbox as a boolean, read by the one checkbox reader
 * (`checkbox-literal-service.ts`) — SQLite hands one back as `1`/`0`, so a
 * rule reading a checkbox would otherwise never match there. An empty value
 * stays empty.
 */
const comparableRow = (table: AppTable, row: Row): Row =>
  Object.fromEntries(
    Object.entries(row).map(([name, value]) => {
      const type = fieldTypeOf(table, name)
      if (type !== undefined && NUMERIC_FIELD_TYPES.has(type))
        return [name, normalized(type, value)]
      return [name, fieldLiteralOf(type, value)]
    })
  )

/** A column name made readable: `due_date` reads `Due date`. */
const readableName = (name: string): string => {
  const words = name.replaceAll('_', ' ')
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`
}

/** How a default refusal names a field: its `label` (a `$t:` key resolves later), else its name made readable. */
const fieldNameForReader = (table: AppTable, field: string): string => {
  const declared = table.fields.find((candidate) => candidate.name === field)
  const label = (declared as { readonly label?: unknown } | undefined)?.label
  return typeof label === 'string' && label.length > 0 ? label : readableName(field)
}

/** Whether a lock holds the whole record: it names neither `fields` nor `except`. */
const locksWholeRecord = (rule: LockRule): boolean =>
  rule.fields === undefined && rule.except === undefined

/**
 * The default refusal of a lock without a `message`: the field it holds named
 * for a reader, or the record when the lock holds it whole, or on a delete.
 */
const defaultLockMessage = (table: AppTable, rule: LockRule, field: string | undefined) =>
  field === undefined || locksWholeRecord(rule)
    ? 'This record can no longer be changed.'
    : `${fieldNameForReader(table, field)} can no longer be changed.`

/** A lock's refusal: its `message` as written (a `$t:` key is resolved by the application). */
const lockMessage = (table: AppTable, rule: LockRule, field: string | undefined) =>
  rule.message ?? defaultLockMessage(table, rule, field)

/** A field a caller writes: declared, not a system field, not computed. */
const isWritableField = (table: AppTable, name: string): boolean => {
  const field = table.fields.find((candidate) => candidate.name === name)
  return (
    field !== undefined &&
    !isSystemFieldName(name) &&
    !isReadonlyComputedFieldType(field.type) &&
    !UNWRITTEN_FIELD_TYPES.has(field.type)
  )
}

/** Whether the lock keeps `name` from changing. */
const locksField = (table: AppTable, rule: LockRule, name: string): boolean =>
  rule.fields === undefined
    ? isWritableField(table, name) && !(rule.except ?? []).includes(name)
    : rule.fields.includes(name)

const blocksOf = (rule: LockRule) => rule.blocks ?? ['update']

const matches = (table: AppTable, when: RowLevelWhen, row: Row, ctx: CurrentUserContext) =>
  evaluateRecordAgainstPredicate(comparableRow(table, row), when, ctx)

const lockViolation = (
  table: AppTable,
  rule: LockRule,
  j: RuleJudgement
): RuleViolation | undefined => {
  // A restore is kept back by the lock that keeps the record from being deleted.
  const blocked = j.op === 'restore' ? 'delete' : j.op
  if (blocked === 'create' || !blocksOf(rule).includes(blocked)) return undefined
  if (!matches(table, rule.when, j.existing, j.ctx)) return undefined
  if (blocked === 'delete') return { rule: rule.name, message: lockMessage(table, rule, undefined) }
  const changed = Object.keys(j.change).find(
    (name) =>
      locksField(table, rule, name) && !sameValue(table, name, j.existing[name], j.change[name])
  )
  return changed === undefined
    ? undefined
    : { rule: rule.name, field: changed, message: lockMessage(table, rule, changed) }
}

/** The values a transition lets `field` move to from `from`. */
const destinationsFrom = (rule: TransitionRule, from: unknown): readonly string[] => {
  const held = isEmpty(from) ? undefined : String(from)
  return [
    ...new Set(
      rule.allow
        .filter((step) => step.from === ANY_VALUE || step.from === held)
        .flatMap((step) => step.to)
    ),
  ]
}

const transitionMessage = (rule: TransitionRule): string =>
  rule.message ?? `${rule.field} cannot move to this value.`

/** Whether a create starts the field on a value the transition allows. */
const startsOnInitial = (table: AppTable, rule: TransitionRule, j: RuleJudgement): boolean => {
  const start = rowAsCreated(table, j.change, j.ctx.userId)[rule.field]
  return rule.initial === undefined || isEmpty(start) || rule.initial.includes(String(start))
}

/** Whether an update moves the field along an allowed step, or leaves it as it was. */
const movesAlong = (table: AppTable, rule: TransitionRule, j: RuleJudgement): boolean => {
  if (!(rule.field in j.change)) return true
  const [from, to] = [j.existing[rule.field], j.change[rule.field]]
  if (sameValue(table, rule.field, from, to)) return true
  return !isEmpty(to) && destinationsFrom(rule, from).includes(String(to))
}

const transitionViolation = (
  table: AppTable,
  rule: TransitionRule,
  j: RuleJudgement
): RuleViolation | undefined => {
  if (j.op === 'delete' || j.op === 'restore') return undefined
  const allowed = j.op === 'create' ? startsOnInitial(table, rule, j) : movesAlong(table, rule, j)
  return allowed
    ? undefined
    : { rule: rule.name, field: rule.field, message: transitionMessage(rule) }
}

/** The field a validation is about: the first plain column its requirement reads. */
const validatedField = (rule: ValidateRule): string | undefined =>
  leavesOf(rule.require).find((leaf) => !isRowRuleChain(leaf.field))?.field

/** Whether a validation judges `op`: a restore is judged as an update, a delete never. */
const validatesOp = (rule: ValidateRule, op: RuleJudgement['op']): boolean => {
  if (op === 'delete') return false
  return (rule.on ?? ['create', 'update']).includes(op === 'restore' ? 'update' : op)
}

/** The row a validation reads: the created row, or the stored one with the change laid over it. */
const validatedRow = (table: AppTable, j: RuleJudgement): Row =>
  j.op === 'create'
    ? rowAsCreated(table, j.change, j.ctx.userId)
    : rowAsWritten(j.existing, j.change)

const validateViolation = (
  table: AppTable,
  rule: ValidateRule,
  j: RuleJudgement
): RuleViolation | undefined => {
  if (!validatesOp(rule, j.op)) return undefined
  const row = validatedRow(table, j)
  if (rule.if !== undefined && !matches(table, rule.if, row, j.ctx)) return undefined
  if (matches(table, rule.require, row, j.ctx)) return undefined
  // A restore changes no field: its refusal, like a delete's, concerns the whole record.
  const field = j.op === 'restore' ? undefined : validatedField(rule)
  return {
    rule: rule.name,
    ...(field === undefined ? {} : { field }),
    message: rule.message,
  }
}

const violationOf = (table: AppTable, rule: BusinessRule, j: RuleJudgement) => {
  if (rule.kind === 'lock') return lockViolation(table, rule, j)
  if (rule.kind === 'transition') return transitionViolation(table, rule, j)
  return validateViolation(table, rule, j)
}

/**
 * Every rule of `tableName` one write breaks, in the order the rules are
 * declared — none for a table without rules. The writer's role is read only
 * for `exemptRoles`: an admin is bound like anyone else.
 */
export const ruleViolations = (
  app: App,
  tableName: string,
  writer: Pick<RuleWriter, 'role'>,
  j: RuleJudgement
): readonly RuleViolation[] => {
  const table = tableOf(app, tableName)
  if (table === undefined) return []
  return rulesOf(table)
    .filter((rule) => !exempts(rule, writer.role))
    .flatMap((rule) => {
      const violation = violationOf(table, rule, j)
      return violation === undefined ? [] : [violation]
    })
}

/** The locked fields one matching lock contributes: a list, or `*` for every writable field. */
const lockedFieldsOf = (table: AppTable, rule: LockRule): readonly string[] | '*' => {
  if (rule.fields !== undefined) return rule.fields
  if (rule.except === undefined) return ANY_VALUE
  return table.fields.map((field) => field.name).filter((name) => locksField(table, rule, name))
}

const nextOf = (
  rules: readonly TransitionRule[],
  existing: Row,
  readable: (name: string) => boolean
): Readonly<Record<string, readonly string[]>> =>
  Object.fromEntries(
    rules
      .filter((rule) => readable(rule.field))
      .map((rule) => [
        rule.field,
        destinationsFrom(rule, existing[rule.field]).filter(
          (value) => value !== String(existing[rule.field] ?? '')
        ),
      ])
  )

/** The fields the holding locks keep from changing for a reader, and why. */
const lockedFieldsAndReasons = (
  table: AppTable,
  updating: readonly LockRule[],
  readable: (name: string) => boolean
): Pick<LocksBlock, 'fields' | 'reasons'> => {
  const lists = updating.map((rule) => [rule, lockedFieldsOf(table, rule)] as const)
  const everything = lists.find(([, fields]) => fields === ANY_VALUE)
  if (everything !== undefined) {
    return {
      fields: ANY_VALUE,
      reasons: { [ANY_VALUE]: lockMessage(table, everything[0], undefined) },
    }
  }
  const named = lists.flatMap(([rule, fields]) =>
    fields === ANY_VALUE ? [] : fields.filter(readable).map((field) => [field, rule] as const)
  )
  // The first rule locking a field gives its reason.
  const reasons = named.reduce<Readonly<Record<string, string>>>(
    (acc, [field, rule]) =>
      field in acc ? acc : { ...acc, [field]: lockMessage(table, rule, field) },
    {}
  )
  return { fields: Object.keys(reasons), ...(named.length === 0 ? {} : { reasons }) }
}

/** The rules that bind a reader on a read, a list reading only the row's own columns. */
const bindingRules = (table: AppTable | undefined, role: string | undefined, own: boolean) =>
  rulesOf(table).filter((rule) => !exempts(rule, role) && !(own && ruleNeedsLookups(rule)))

/** What {@link locksOf} judges: one stored record, for one reader. */
export interface LocksInput {
  readonly app: App
  readonly tableName: string
  readonly reader: Pick<RuleWriter, 'role' | 'groups'>
  readonly existing: Row
  readonly ctx: CurrentUserContext
  /** Judge only the rules that read the record's own columns (a list read). */
  readonly ownColumnsOnly?: boolean
}

/** The `_locks` block from its parts, `undefined` when it would say nothing. */
const blockOf = (
  locked: Pick<LocksBlock, 'fields' | 'reasons'>,
  deleteReason: string | undefined,
  next: Readonly<Record<string, readonly string[]>>
): LocksBlock | undefined => {
  const moves = Object.keys(next).length > 0
  if (locked.fields.length === 0 && deleteReason === undefined && !moves) return undefined
  return {
    fields: locked.fields,
    ...(deleteReason === undefined ? {} : { delete: true as const, deleteReason }),
    ...(moves ? { next } : {}),
    ...(locked.reasons === undefined ? {} : { reasons: locked.reasons }),
  }
}

/**
 * The `_locks` block of one stored record for one reader, or `undefined` when
 * the table declares no rule or nothing is locked for her. Names no field the
 * reader may not read.
 */
export const locksOf = (input: LocksInput): LocksBlock | undefined => {
  const { app, tableName, reader, existing, ctx } = input
  const table = tableOf(app, tableName)
  const binding = bindingRules(table, reader.role, input.ownColumnsOnly === true)
  if (table === undefined || binding.length === 0) return undefined
  const caller = { role: reader.role ?? '', groups: [...(reader.groups ?? [])] }
  const readable = (name: string) => isFieldReadableByCaller(app, tableName, caller, name)
  const holding = binding.filter(
    (rule): rule is LockRule => rule.kind === 'lock' && matches(table, rule.when, existing, ctx)
  )
  const updating = holding.filter((rule) => blocksOf(rule).includes('update'))
  const { fields, reasons } = lockedFieldsAndReasons(table, updating, readable)
  const transitions = binding.filter((rule): rule is TransitionRule => rule.kind === 'transition')
  const next = nextOf(transitions, existing, readable)
  const deleting = holding.find((rule) => blocksOf(rule).includes('delete'))
  const deleteReason = deleting === undefined ? undefined : lockMessage(table, deleting, undefined)
  return blockOf({ fields, reasons }, deleteReason, next)
}
