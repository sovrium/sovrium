/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A table's business rules (`tables[].rules`) that could never be judged the
 * way they read are refused before the app starts.
 *
 * Three levels, because each needs a different slice of the config:
 *
 *  - the TABLE ({@link validateBusinessRules}): names unique; `fields` and
 *    `except` naming writable fields of the table, never both; a transition
 *    on a `single-select` or `status` field, every value one of its options and
 *    the field's `default` one of `initial`; each predicate free of
 *    `$currentUser`, naming a column of the table, comparing it with a value it
 *    can store (the row rules' own type check) and, on a one-of field, with one
 *    of its options;
 *  - the TABLES ({@link validateBusinessRuleChains}): a `<relationship>.<field>`
 *    predicate followed one many-to-one relationship deep, as a row rule is;
 *  - the APP ({@link validateBusinessRuleAppReferences}): every `exemptRoles`
 *    entry a declared role, every `$t:` message translated in every language.
 *
 * {@link businessRuleNotices} reports what is legal but probably not meant: a
 * lock covering every field also freezes the field a transition moves.
 */

import { BUILT_IN_ROLES } from '@/domain/models/app/auth/roles/role'
import { isReadonlyComputedFieldType } from './fields/field'
import { isPredicateGroup, rowRuleNamesCurrentUser } from './row-level-evaluator-service'
import { isRowRuleChain } from './row-rule-chain-service'
import { validateRowRuleChains } from './row-rule-chain-validation'
import { validateRowRuleTypes } from './row-rule-types-validation'
import { optionValue } from './select-option'
import { isSystemFieldName } from './system-fields'
import type { RowLevelPredicate, RowLevelWhen } from './row-level-permissions'
import type { BusinessRule, TableRules } from './rules'
import type { SelectOptionLike } from './select-option'

interface RuleField {
  readonly name: string
  readonly type: string
  readonly relatedTable?: string | undefined
  readonly relationType?: string | undefined
  readonly allowMultiple?: boolean | undefined
  readonly options?: ReadonlyArray<SelectOptionLike> | undefined
  readonly default?: unknown
}

interface RuledTable {
  readonly name: string
  readonly fields: ReadonlyArray<RuleField>
  readonly rules?: TableRules | undefined
}

interface RuleError {
  readonly message: string
  readonly path: ReadonlyArray<string>
}

/** The one-of field types a transition may move, and whose values a predicate is held to. */
const ONE_OF_FIELD_TYPES: ReadonlySet<string> = new Set(['single-select', 'status'])

/** Field types that hold a value no caller writes: a lock cannot keep them. */
const SYSTEM_MANAGED_FIELD_TYPES: ReadonlySet<string> = new Set([
  'created-at',
  'updated-at',
  'deleted-at',
  'created-by',
  'updated-by',
  'deleted-by',
  'button',
])

/** The wildcard a transition step writes for "from any value". */
const ANY_VALUE = '*'

const optionValuesOf = (field: RuleField | undefined): readonly string[] =>
  (field?.options ?? []).map(optionValue)

const quoted = (values: readonly string[]): string => values.map((v) => `"${v}"`).join(', ')

/** Every predicate triple of a `when`, walking each condition of a group. */
const leavesOf = (when: RowLevelWhen): readonly RowLevelPredicate[] =>
  isPredicateGroup(when) ? when.conditions.flatMap(leavesOf) : [when]

/** The predicates a rule carries, keyed by the rule key holding each. */
const predicatesOf = (rule: BusinessRule): ReadonlyArray<readonly [string, RowLevelWhen]> => {
  if (rule.kind === 'lock') return [['when', rule.when]]
  if (rule.kind === 'validate') {
    return rule.if === undefined
      ? [['require', rule.require]]
      : [
          ['if', rule.if],
          ['require', rule.require],
        ]
  }
  return []
}

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

/** A literal compared with a one-of field that is none of its options. */
const undeclaredOption = (
  leaf: RowLevelPredicate,
  field: RuleField | undefined
): string | undefined => {
  if (field === undefined || !ONE_OF_FIELD_TYPES.has(field.type)) return undefined
  const options = optionValuesOf(field)
  const values: readonly unknown[] = Array.isArray(leaf.value) ? leaf.value : [leaf.value]
  return values.map(String).find((value) => !options.includes(value))
}

/** The refusal of one predicate triple of a rule, or `undefined`. */
const leafError = (
  rule: BusinessRule,
  leaf: RowLevelPredicate,
  fields: ReadonlyMap<string, RuleField>
): string | undefined => {
  if (isRowRuleChain(leaf.field)) return undefined
  const field = fields.get(leaf.field)
  if (field === undefined && !isSystemFieldName(leaf.field)) {
    return `rule "${rule.name}" compares "${leaf.field}", which is not a field of this table`
  }
  const undeclared = undeclaredOption(leaf, field)
  return undeclared === undefined
    ? undefined
    : `rule "${rule.name}" compares "${leaf.field}" with "${undeclared}", which is not one of its options (${quoted(optionValuesOf(field))})`
}

/** The refusal of one predicate of a rule, or `undefined` when it can be judged. */
const predicateError = (
  rule: BusinessRule,
  when: RowLevelWhen,
  fields: ReadonlyArray<RuleField>
): string | undefined => {
  if (rowRuleNamesCurrentUser(when)) {
    return `rule "${rule.name}" names $currentUser: a rule describes the data, whoever writes it — to scope a write to the person making it, use rowLevelPermissions, and to free a role from a rule, list it in exemptRoles`
  }
  const byName = new Map(fields.map((field) => [field.name, field]))
  const typeError = validateRowRuleTypes({ write: { when } }, fields)
  if (typeError !== undefined) {
    return typeError.message.replace(/^row rule on/, `rule "${rule.name}" on`)
  }
  return leavesOf(when)
    .map((leaf) => leafError(rule, leaf, byName))
    .find((message) => message !== undefined)
}

// ---------------------------------------------------------------------------
// Locks and transitions
// ---------------------------------------------------------------------------

/** Why `name` cannot be kept by a lock, or `undefined` when it can. */
const unlockable = (name: string, fields: ReadonlyMap<string, RuleField>): string | undefined => {
  if (isSystemFieldName(name)) return `"${name}" is a system field, which no caller writes`
  const field = fields.get(name)
  if (field === undefined) return `"${name}" is not a field of this table`
  if (isReadonlyComputedFieldType(field.type)) {
    return `"${name}" is a ${field.type} field, computed rather than written`
  }
  return SYSTEM_MANAGED_FIELD_TYPES.has(field.type)
    ? `"${name}" is a ${field.type} field, which no caller writes`
    : undefined
}

const lockError = (
  rule: Extract<BusinessRule, { readonly kind: 'lock' }>,
  fields: ReadonlyMap<string, RuleField>
): { readonly key: string; readonly message: string } | undefined => {
  if (rule.fields !== undefined && rule.except !== undefined) {
    return {
      key: 'except',
      message: `rule "${rule.name}" declares both fields and except: list the locked fields in fields, or leave fields out and list the free ones in except`,
    }
  }
  const key = rule.fields === undefined ? 'except' : 'fields'
  const refusal = (rule.fields ?? rule.except ?? [])
    .map((name) => unlockable(name, fields))
    .find((message) => message !== undefined)
  return refusal === undefined ? undefined : { key, message: `rule "${rule.name}": ${refusal}` }
}

/** The first value of `values` that is not one of `options`, `*` allowed when `wildcard`. */
const strayValue = (
  values: readonly string[],
  options: readonly string[],
  wildcard: boolean
): string | undefined =>
  values.find((value) => !options.includes(value) && !(wildcard && value === ANY_VALUE))

const transitionValuesError = (
  rule: Extract<BusinessRule, { readonly kind: 'transition' }>,
  field: RuleField
): { readonly key: string; readonly message: string } | undefined => {
  const options = optionValuesOf(field)
  const outside = (value: string, where: string): string =>
    `rule "${rule.name}" names "${value}" in ${where}, which is not one of the options of "${field.name}" (${quoted(options)})`
  const strayFrom = strayValue(
    rule.allow.map((step) => step.from),
    options,
    true
  )
  if (strayFrom !== undefined) return { key: 'allow', message: outside(strayFrom, 'allow[].from') }
  const strayTo = strayValue(
    rule.allow.flatMap((step) => step.to),
    options,
    false
  )
  if (strayTo !== undefined) return { key: 'allow', message: outside(strayTo, 'allow[].to') }
  const froms = rule.allow.map((step) => step.from)
  const repeated = froms.find((from, index) => froms.indexOf(from) !== index)
  if (repeated !== undefined) {
    return {
      key: 'allow',
      message: `rule "${rule.name}" lists from "${repeated}" twice: put every move from one value in one entry`,
    }
  }
  const strayInitial = strayValue(rule.initial ?? [], options, false)
  if (strayInitial !== undefined)
    return { key: 'initial', message: outside(strayInitial, 'initial') }
  return typeof field.default === 'string' &&
    rule.initial !== undefined &&
    !rule.initial.includes(field.default)
    ? {
        key: 'initial',
        message: `rule "${rule.name}": "${field.name}" defaults to "${field.default}", which initial does not allow — a new record left on its default would be refused`,
      }
    : undefined
}

const transitionError = (
  rule: Extract<BusinessRule, { readonly kind: 'transition' }>,
  fields: ReadonlyMap<string, RuleField>
): { readonly key: string; readonly message: string } | undefined => {
  const field = fields.get(rule.field)
  if (field === undefined || !ONE_OF_FIELD_TYPES.has(field.type)) {
    const what = field === undefined ? 'is not a field of this table' : `is a ${field.type} field`
    return {
      key: 'field',
      message: `rule "${rule.name}" moves "${rule.field}", which ${what}: a transition moves a single-select or status field`,
    }
  }
  return transitionValuesError(rule, field)
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

/** The first refusal of one rule, located under `rules[<index>]`. */
const ruleError = (
  rule: BusinessRule,
  index: number,
  table: RuledTable,
  byName: ReadonlyMap<string, RuleField>
): RuleError | undefined => {
  const at = (key: string): ReadonlyArray<string> => ['rules', String(index), key]
  const shaped =
    rule.kind === 'lock'
      ? lockError(rule, byName)
      : rule.kind === 'transition'
        ? transitionError(rule, byName)
        : undefined
  if (shaped !== undefined) return { message: shaped.message, path: at(shaped.key) }
  return predicatesOf(rule)
    .map(([key, when]) => {
      const message = predicateError(rule, when, table.fields)
      return message === undefined ? undefined : { message, path: at(key) }
    })
    .find((error) => error !== undefined)
}

/**
 * The first rule of a table that could never be judged the way it reads, with
 * what to write instead; `undefined` when every rule can.
 */
export const validateBusinessRules = (table: RuledTable): RuleError | undefined => {
  const rules = table.rules ?? []
  const names = rules.map((rule) => rule.name)
  const repeated = names.findIndex((name, index) => names.indexOf(name) !== index)
  if (repeated !== -1) {
    return {
      message: `Two rules of this table are named "${names[repeated] ?? ''}": a refusal names the rule it broke, so each name must be unique within the table`,
      path: ['rules', String(repeated), 'name'],
    }
  }
  const byName = new Map(table.fields.map((field) => [field.name, field]))
  return rules
    .map((rule, index) => ruleError(rule, index, table, byName))
    .find((error) => error !== undefined)
}

/**
 * The first `<relationship>.<field>` rule predicate of the app that cannot be
 * followed one many-to-one relationship deep, or `undefined`. Judged by the
 * row rules' own chain check, so the two can never accept different chains.
 */
export const validateBusinessRuleChains = (tables: ReadonlyArray<RuledTable>): string | undefined =>
  validateRowRuleChains(
    tables.map((table) => {
      const whens = (table.rules ?? []).flatMap((rule) => predicatesOf(rule).map(([, w]) => w))
      return {
        name: table.name,
        fields: table.fields as ReadonlyArray<{ readonly name: string; readonly type: string }>,
        ...(whens.length === 0
          ? {}
          : { rowLevelPermissions: { write: { when: { conditions: whens } } } }),
      }
    })
  )?.replace(': row rule on', ': rule on')

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

interface RuleReferencingApp {
  readonly auth?: { readonly roles?: ReadonlyArray<{ readonly name: string }> } | undefined
  readonly languages?:
    | { readonly translations?: Readonly<Record<string, Readonly<Record<string, unknown>>>> }
    | undefined
  readonly tables?: ReadonlyArray<RuledTable> | undefined
}

const TRANSLATION_PREFIX = '$t:'

const roleError = (app: RuleReferencingApp, table: RuledTable): string | undefined => {
  const declared = [...BUILT_IN_ROLES, ...(app.auth?.roles ?? []).map((role) => role.name)]
  return (table.rules ?? [])
    .flatMap((rule) =>
      (rule.exemptRoles ?? [])
        .filter((role) => !declared.includes(role))
        .map(
          (role) =>
            `Table "${table.name}": rule "${rule.name}" exempts the role "${role}", which the app does not declare (declared: ${declared.join(', ')})`
        )
    )
    .at(0)
}

const translationError = (app: RuleReferencingApp, table: RuledTable): string | undefined => {
  const dictionaries = Object.entries(app.languages?.translations ?? {})
  return (table.rules ?? [])
    .flatMap((rule) => {
      const { message } = rule
      if (message === undefined || !message.startsWith(TRANSLATION_PREFIX)) return []
      const key = message.slice(TRANSLATION_PREFIX.length)
      if (dictionaries.length === 0) {
        return [
          `Table "${table.name}": rule "${rule.name}" answers with ${message}, but the app declares no languages.translations to read it from`,
        ]
      }
      return dictionaries
        .filter(([, dictionary]) => dictionary[key] === undefined)
        .map(
          ([language]) =>
            `Table "${table.name}": rule "${rule.name}" answers with ${message}, which the "${language}" translations do not define`
        )
    })
    .at(0)
}

/**
 * The first rule of the app exempting a role it does not declare, or answering
 * with a `$t:` key a language leaves untranslated; `undefined` otherwise.
 */
export const validateBusinessRuleAppReferences = (app: RuleReferencingApp): string | undefined =>
  (app.tables ?? [])
    .map((table) => roleError(app, table) ?? translationError(app, table))
    .find((message) => message !== undefined)

/**
 * What a table's rules allow but probably do not mean: a lock that covers
 * every field (no `fields`) without leaving out the field a transition of the
 * same table moves, which freezes that field once the record is locked.
 */
export const businessRuleNotices = (table: RuledTable): readonly string[] => {
  const rules = table.rules ?? []
  const moved = rules.flatMap((rule) => (rule.kind === 'transition' ? [rule.field] : []))
  return rules.flatMap((rule) =>
    rule.kind === 'lock' && rule.fields === undefined
      ? moved
          .filter((field) => !(rule.except ?? []).includes(field))
          .map(
            (field) =>
              `Table "${table.name}": lock "${rule.name}" covers every field, so "${field}" cannot move once a record is locked — add "${field}" to the lock's except if it should`
          )
      : []
  )
}
