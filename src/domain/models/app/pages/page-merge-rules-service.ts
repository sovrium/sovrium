/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The page merge, one node's RULES: the binding, visibility, data source,
 * embedded form and button link a Claude Design canvas carries on a node
 * (`claude-design-canvas-rules.ts`), compared with an unedited export's.
 *
 * An edited rule is written as that property of the node, in the config's own
 * shape. A rule naming a table, a field (a visibility field, or a data source's
 * sort or filter field), a form or a page the config does not declare is refused `UNDECLARED_REFERENCE` by name and never written; the
 * whole resulting config is still judged as `sovrium validate` judges it
 * before a byte is written, so a rule the drawing carries goes through the
 * same decode as one written by hand. A node whose binding was rewritten draws
 * a sample of it, which is never read as copy.
 *
 * Pure: no I/O, the same inputs always give the same findings.
 */

import { isResolvableColumnName } from '@/domain/models/app/tables/system-fields'
import type { DrawnRules } from './page-drawing'
import type { PageImportReport } from '@/domain/models/api/admin/design-system/page-import-report'
import type { PageNodeMap } from '@/domain/models/api/admin/design-system/page-node-map'

type Page = PageImportReport['pages'][number]
type Node = Readonly<Record<string, unknown>>
type MapEntry = PageNodeMap['pages'][number]['nodes'][number]

/** What the config declares that a rule may name. */
export interface RuleReferences {
  /** Each table, with the names of its fields. */
  readonly tables: ReadonlyMap<string, ReadonlySet<string>>
  readonly forms: ReadonlySet<string>
  /** Each page's path. */
  readonly paths: ReadonlySet<string>
}

/** What one node's rules came to, and how to write them. */
export interface RuleFindings {
  readonly changes: Page['changes']
  readonly refused: Page['refused']
  readonly ignored: Page['ignored']
  readonly apply: (node: Node) => Node
  /** Whether the binding was rewritten, so the text the node draws is a sample. */
  readonly rebound: boolean
}

/** One rule's outcome. */
type Outcome =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'written'
      readonly change: Page['changes'][number]
      readonly apply: (node: Node) => Node
    }
  | { readonly kind: 'refused'; readonly reason: string }
  | { readonly kind: 'unread'; readonly reason: string }

const NONE: Outcome = { kind: 'none' }

/** The JSON a rule holds, or `undefined` when it holds none. */
const parsedJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown
  } catch {
    // Reported as a rule not read.
    return undefined
  }
}

const isObject = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** What one edited rule says: its node, the drawn and unedited text, the property it is written to. */
interface RuleEdit {
  readonly node: string
  readonly property: string
  readonly before: string | undefined
  readonly after: string
}

const written = (edit: RuleEdit, apply: (node: Node) => Node): Outcome => ({
  kind: 'written',
  change: {
    node: edit.node,
    property: edit.property,
    ...(edit.before === undefined ? {} : { before: edit.before }),
    after: edit.after,
  },
  apply,
})

/** A JSON rule, written as its property when it parses and names what the config declares. */
const jsonRule = (edit: RuleEdit, undeclared: (value: Node) => string | undefined): Outcome => {
  const value = parsedJson(edit.after)
  if (!isObject(value)) {
    return {
      kind: 'unread',
      reason: `The ${edit.property} the drawing carries is no JSON object, so it was not read; write it as the config does.`,
    }
  }
  const reason = undeclared(value)
  if (reason !== undefined) return { kind: 'refused', reason }
  return written(edit, (node) => ({ ...node, [edit.property]: value }))
}

/** Why a visibility rule names a field the page's table does not declare, if it does. */
const undeclaredField = (
  value: Node,
  table: { readonly name: string; readonly fields: ReadonlySet<string> } | undefined
): string | undefined => {
  const record = value['record'] as { readonly field?: unknown } | undefined
  const field = record?.field
  if (table === undefined || typeof field !== 'string' || table.fields.has(field)) return undefined
  return `The visibility rule names the field ${field}, which the table ${table.name} does not declare; name a declared field.`
}

/** Why a data source names a table the config does not declare, if it does. */
const undeclaredTable = (value: Node, references: RuleReferences): string | undefined => {
  const { table } = value
  return typeof table === 'string' && !references.tables.has(table)
    ? `The data source names the table ${table}, which this config does not declare; declare it, or name a declared table.`
    : undefined
}

/**
 * Why a data source sorts or filters on a field its table does not declare, if
 * it does. A system column (`id`, the timestamps, the authorship columns) is a
 * real column, as the whole-config validation counts it.
 */
const undeclaredSortOrFilterField = (
  value: Node,
  references: RuleReferences
): string | undefined => {
  const { table } = value
  const fields = typeof table === 'string' ? references.tables.get(table) : undefined
  if (fields === undefined) return undefined
  const named = (['sort', 'filter'] as const).flatMap((key) => {
    const entries = value[key]
    if (!Array.isArray(entries)) return []
    return entries.flatMap((entry: unknown) => {
      const field = isObject(entry) ? entry['field'] : undefined
      return typeof field === 'string' && !isResolvableColumnName(fields, field)
        ? [{ key, field }]
        : []
    })
  })
  const [first] = named
  return first === undefined
    ? undefined
    : `The data source's ${first.key} names the field ${first.field}, which the table ${String(table)} does not declare; name a declared field.`
}

/** The binding's own property on the node: where its text is kept. */
const boundProperty = (entry: MapEntry | undefined): 'content' | 'children.0' =>
  (entry?.bindings ?? []).some((binding) => binding.property === 'children.0')
    ? 'children.0'
    : 'content'

/** A node with its bound text set where it keeps it. */
const withBound = (node: Node, property: 'content' | 'children.0', text: string): Node =>
  property === 'content' ? { ...node, content: text } : { ...node, children: [text] }

/** One rule, read as drawn against the unedited export. */
const outcomeOf = (
  kind: keyof DrawnRules,
  edit: Omit<RuleEdit, 'property'>,
  context: {
    readonly entry: MapEntry | undefined
    readonly references: RuleReferences
    readonly pageTable: string | undefined
  }
): Outcome => {
  const { references } = context
  if (kind === 'bind') {
    const property = boundProperty(context.entry)
    return written({ ...edit, property }, (node) => withBound(node, property, edit.after))
  }
  if (kind === 'visible') {
    const fields =
      context.pageTable === undefined ? undefined : references.tables.get(context.pageTable)
    const table =
      context.pageTable === undefined || fields === undefined
        ? undefined
        : { name: context.pageTable, fields }
    return jsonRule({ ...edit, property: 'visibility' }, (value) => undeclaredField(value, table))
  }
  if (kind === 'source') {
    return jsonRule(
      { ...edit, property: 'dataSource' },
      (value) =>
        undeclaredTable(value, references) ?? undeclaredSortOrFilterField(value, references)
    )
  }
  if (kind === 'form') {
    return references.forms.has(edit.after)
      ? written({ ...edit, property: 'formRef' }, (node) => ({ ...node, formRef: edit.after }))
      : {
          kind: 'refused',
          reason: `The form ${edit.after} is not one this config declares; name a declared form.`,
        }
  }
  return references.paths.has(edit.after)
    ? written({ ...edit, property: 'action' }, (node) => ({
        ...node,
        action: { type: 'navigate', path: edit.after },
      }))
    : {
        kind: 'refused',
        reason: `The link leads to ${edit.after}, which no page of this config is at; link to a declared page.`,
      }
}

const KINDS: readonly (keyof DrawnRules)[] = ['bind', 'visible', 'source', 'form', 'href']

/**
 * Every rule a node carries that an unedited export does not: written, or
 * refused naming what the config does not declare.
 *
 * @param subject - the node's path id, its map entry, and its rules as drawn and unedited.
 * @param context - what the config declares, and the table the page reads.
 */
export const ruleFindings = (
  subject: {
    readonly node: string
    readonly entry: MapEntry | undefined
    readonly drawn: DrawnRules | undefined
    readonly baseline: DrawnRules | undefined
  },
  context: {
    readonly references: RuleReferences | undefined
    readonly pageTable: string | undefined
  }
): RuleFindings => {
  const { references } = context
  const outcomes =
    references === undefined
      ? []
      : KINDS.map((kind) => {
          const after = subject.drawn?.[kind]
          const before = subject.baseline?.[kind]
          if (after === undefined || after === before) return [kind, NONE] as const
          const edit = { node: subject.node, before, after }
          return [
            kind,
            outcomeOf(kind, edit, {
              entry: subject.entry,
              references,
              pageTable: context.pageTable,
            }),
          ] as const
        })
  const of = <K extends Outcome['kind']>(kind: K) =>
    outcomes.flatMap(([, outcome]) =>
      outcome.kind === kind ? [outcome as Extract<Outcome, { readonly kind: K }>] : []
    )
  return {
    changes: of('written').map((outcome) => outcome.change),
    refused: of('refused').map((outcome) => ({
      node: subject.node,
      code: 'UNDECLARED_REFERENCE' as const,
      reason: outcome.reason,
    })),
    ignored: of('unread').map((outcome) => ({ node: subject.node, reason: outcome.reason })),
    apply: (node) => of('written').reduce((acc, outcome) => outcome.apply(acc), node),
    rebound: outcomes.some(([kind, outcome]) => kind === 'bind' && outcome.kind === 'written'),
  }
}
