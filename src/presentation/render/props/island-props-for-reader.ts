/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One island's props as their reader may see them: nothing in them names a
 * field she may not read.
 *
 * Every island props object is written into the page, so whatever it carries
 * is readable with "view source". Per-component narrowing (`caller-table-
 * inputs.ts`, `record-view-for-reader.ts`) decides what each component DRAWS
 * for her; this walk is the structural guarantee behind it, applied to the
 * whole payload of every island at the one place the page is emitted
 * (`page-payload-for-reader.ts`), so a component nobody has narrowed yet is
 * covered without opting in. It knows no component type. It reads the shape:
 *
 *  - a string value that IS a hidden field's name (`rowColorField`,
 *    `searchFields[]`, `kpiAggregate.field`) is dropped — the key, or the
 *    array element;
 *  - a string value whose `$record.` template names a hidden field (a card
 *    line, an event's path, a list item's subtitle) is dropped the same way;
 *  - when the dropped value sat under a key that says what its object is ABOUT
 *    (`field`, `name`, `path`, `content`, …), the whole object goes with it:
 *    a column, a form input, a card line, a navigation action — the part,
 *    never a husk of it;
 *  - a key that IS a hidden field's name, label or option value is dropped
 *    (`fieldMeta.<name>`, `rowColorFieldColors.<option>`), and so is every
 *    sibling key derived from a dropped one (`rowColorField` takes
 *    `rowColorFieldColors` with it).
 *
 * Inside the rows a payload carries (`records`, `rows`, …) and an option list,
 * only KEYS are judged: a stored value is the reader's data, never a field
 * reference, and it was read through the records API's own mask already.
 *
 * Which fields are hidden is the table's: an object that names its table
 * (`table`, `dataSource.table`) is judged against that table's hidden fields,
 * and against the names hidden on EVERY table that declares them — the only
 * ones an object naming no table can be judged against without dropping a
 * readable field of another table that happens to share the name.
 */

import { recordFieldRefsIn } from '@/domain/models/app/pages/substitute-record-vars'

/** What one reader may not read of one table, or of every table at once. */
export interface ReaderFieldScope {
  /** The names of the fields she may not read. */
  readonly hiddenNames: ReadonlySet<string>
  /** Their labels and option values, none of them also a readable field's. */
  readonly hiddenTerms: ReadonlySet<string>
}

/** A reader's hidden fields, per table and across every table. */
export interface ReaderFieldModel {
  readonly byTable: ReadonlyMap<string, ReaderFieldScope>
  /** The names and terms hidden on every table that declares them. */
  readonly everywhere: ReaderFieldScope
}

/** The marker a dropped value travels up the walk as. */
const DROP: unique symbol = Symbol('drop')
type Walked = unknown

/** Keys whose string value is a kind, a token or an id — never a field reference. */
const STRUCTURAL_KEYS: ReadonlySet<string> = new Set([
  'type',
  'element',
  'variant',
  'operation',
  'function',
  'mode',
  'format',
  'role',
  'id',
  'method',
  'table',
  'relatedTable',
  'relationType',
  'chartType',
  'icon',
  'size',
  'align',
  'justify',
  'position',
  'direction',
  'layout',
  'as',
  'kind',
  'action',
  'component',
  'target',
])

/** Keys naming what their object is about: a hidden one drops the object. */
const REFERENCE_KEYS: ReadonlySet<string> = new Set([
  'field',
  'fieldName',
  'name',
  'path',
  'href',
  'url',
  'src',
  'content',
  'text',
  'value',
  'template',
  'label',
])

/** Keys holding stored values or option lists: only their keys are judged. */
const DATA_KEYS: ReadonlySet<string> = new Set([
  'records',
  'record',
  'rows',
  'initialRecords',
  'initialRows',
  'initialValues',
  'defaultValue',
  'options',
  'columnOptions',
])

const EMPTY_SCOPE: ReaderFieldScope = { hiddenNames: new Set(), hiddenTerms: new Set() }

/** True when the model hides nothing at all — the walk has nothing to do. */
export function hidesNothing(model: ReaderFieldModel): boolean {
  return (
    model.everywhere.hiddenNames.size === 0 &&
    [...model.byTable.values()].every((scope) => scope.hiddenNames.size === 0)
  )
}

/** Two scopes as one. */
const union = (a: ReaderFieldScope, b: ReaderFieldScope): ReaderFieldScope => ({
  hiddenNames: new Set([...a.hiddenNames, ...b.hiddenNames]),
  hiddenTerms: new Set([...a.hiddenTerms, ...b.hiddenTerms]),
})

type Bag = Readonly<Record<string, unknown>>

const bagOf = (value: unknown): Bag | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Bag) : undefined

/** The table an object says it is about, when it names one. */
function tableNamedBy(bag: Bag): string | undefined {
  const own = bag['table']
  if (typeof own === 'string') return own
  const bound = bagOf(bag['dataSource'])?.['table']
  return typeof bound === 'string' ? bound : undefined
}

interface WalkContext {
  readonly model: ReaderFieldModel
  readonly scope: ReaderFieldScope
  /** Inside stored values or an option list: only keys are judged. */
  readonly inData: boolean
  /** An HTML string that itself carries island props (a server-rendered panel). */
  readonly scrubHtml: (html: string) => string
}

/** True for a string that names a field hidden in `scope`. */
function namesHidden(value: string, scope: ReaderFieldScope): boolean {
  return (
    scope.hiddenNames.has(value) ||
    recordFieldRefsIn(value).some((field) => scope.hiddenNames.has(field))
  )
}

function walkString(value: string, ctx: WalkContext): Walked {
  if (value.includes('data-island-props=')) return ctx.scrubHtml(value)
  if (ctx.inData) return value
  return namesHidden(value, ctx.scope) ? DROP : value
}

function walkArray(values: readonly unknown[], ctx: WalkContext): Walked {
  const walked = values.map((value) => walkValue(value, ctx))
  const kept = walked.filter((value) => value !== DROP)
  return kept.length === values.length && walked.every((value, i) => value === values[i])
    ? values
    : kept
}

/** The scope an object is judged in: its own table's, when it names one. */
function scopeOf(bag: Bag, ctx: WalkContext): ReaderFieldScope {
  const table = tableNamedBy(bag)
  if (table === undefined) return ctx.scope
  return union(ctx.model.byTable.get(table) ?? EMPTY_SCOPE, ctx.model.everywhere)
}

/**
 * One key of an object: kept as walked; omitted, being itself a hidden name;
 * dropped, its value naming a hidden field — which takes its derived siblings
 * along; or dropping its whole object.
 */
type KeyOutcome =
  | { readonly kind: 'keep'; readonly key: string; readonly value: unknown }
  | { readonly kind: 'omit' }
  | { readonly kind: 'drop'; readonly key: string }
  | { readonly kind: 'dropObject' }

function walkEntry(key: string, value: unknown, ctx: WalkContext): KeyOutcome {
  if (ctx.scope.hiddenNames.has(key) || ctx.scope.hiddenTerms.has(key)) return { kind: 'omit' }
  if (STRUCTURAL_KEYS.has(key) && typeof value === 'string') return { kind: 'keep', key, value }
  const walked = walkValue(value, { ...ctx, inData: ctx.inData || DATA_KEYS.has(key) })
  if (walked !== DROP) return { kind: 'keep', key, value: walked }
  return REFERENCE_KEYS.has(key) && !ctx.inData ? { kind: 'dropObject' } : { kind: 'drop', key }
}

/** The object less its dropped keys and every sibling derived from one. */
function walkObject(bag: Bag, ctx: WalkContext, root: boolean): Walked {
  const scoped = { ...ctx, scope: scopeOf(bag, ctx) }
  const outcomes = Object.entries(bag).map(([key, value]) => walkEntry(key, value, scoped))
  if (!root && outcomes.some((outcome) => outcome.kind === 'dropObject')) return DROP
  const dropped = outcomes.flatMap((outcome) => (outcome.kind === 'drop' ? [outcome.key] : []))
  const kept = outcomes.flatMap((outcome) =>
    outcome.kind === 'keep' && !dropped.some((key) => outcome.key.startsWith(key))
      ? [[outcome.key, outcome.value] as const]
      : []
  )
  const unchanged =
    kept.length === outcomes.length && kept.every(([key, value]) => bag[key] === value)
  return unchanged ? bag : Object.fromEntries(kept)
}

function walkValue(value: unknown, ctx: WalkContext): Walked {
  if (typeof value === 'string') return walkString(value, ctx)
  if (Array.isArray(value)) return walkArray(value, ctx)
  const bag = bagOf(value)
  return bag === undefined ? value : walkObject(bag, ctx, false)
}

/**
 * True for a sign-in form's props that name no table: its inputs are the
 * credentials of the method it signs in with (an address, a password, a code)
 * and its other strings the method, the strategy and the provider — none of
 * them read from a table, so none of them can name a field of one. Judged
 * against the names hidden across tables, they lost the `email` input beside a
 * table hiding its `email` column, and a social sign-in its `provider`. A form
 * BOUND to a table names it (`table`), and is judged against it like any other
 * island.
 */
function isTablelessAuthForm(island: string | undefined, bag: Bag | undefined): boolean {
  return island === 'auth-form' && bag !== undefined && tableNamedBy(bag) === undefined
}

/**
 * `props` as the reader `model` describes may see them — see the module
 * header. The props object itself is never dropped, only emptied of what names
 * a hidden field; the same reference back when nothing does. `island` is the
 * island's name, when the host names it: a sign-in form naming no table is
 * passed through whole ({@link isTablelessAuthForm}).
 */
export function islandPropsForReader(
  props: unknown,
  model: ReaderFieldModel,
  scrubHtml: (html: string) => string,
  island?: string
): unknown {
  const bag = bagOf(props)
  if (isTablelessAuthForm(island, bag)) return props
  const ctx: WalkContext = { model, scope: model.everywhere, inData: false, scrubHtml }
  if (bag === undefined) {
    const walked = walkValue(props, ctx)
    return walked === DROP ? {} : walked
  }
  return walkObject(bag, ctx, true)
}
