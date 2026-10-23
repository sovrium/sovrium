/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The load-time rule of `control` on a TABLE-BOUND form's field, which needs
 * the app's tables and so cannot live on the schema node: a `password` or a
 * `textarea` control draws the column as text, so the column must hold text.
 * A `password` over an integer column would collect a word and post it into a
 * number. Refused when the config is read, naming the field and its column type.
 *
 * Fields the table does not declare, and a table taken from the page address,
 * are left to the rules that already report them. Pure.
 */

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The controls a table-bound form draws its own way, over a text column. */
const TEXT_DRAWN_CONTROLS: ReadonlySet<string> = new Set(['password', 'textarea'])

/** The column types a control drawing text can hold. */
export const TEXT_COLUMN_TYPES: ReadonlySet<string> = new Set([
  'single-line-text',
  'long-text',
  'email',
  'url',
  'phone-number',
])

/** Every object at any depth. */
function collectNodes(node: unknown): readonly RawRecord[] {
  if (Array.isArray(node)) return node.flatMap(collectNodes)
  if (!isRecord(node)) return []
  return [node, ...Object.values(node).flatMap(collectNodes)]
}

/** The type of each field a declared table holds, by name. */
function columnTypes(config: RawRecord, name: string): ReadonlyMap<string, string> | undefined {
  const tables = Array.isArray(config['tables']) ? config['tables'] : []
  const table = tables.find((candidate) => isRecord(candidate) && candidate['name'] === name)
  if (!isRecord(table) || !Array.isArray(table['fields'])) return undefined
  return new Map(
    table['fields'].flatMap((field) =>
      isRecord(field) && typeof field['name'] === 'string'
        ? [[field['name'], String(field['type'] ?? '')] as const]
        : []
    )
  )
}

/** The refusals of one table-bound form. */
function formViolations(config: RawRecord, form: RawRecord): readonly string[] {
  const source = form['dataSource']
  const table = isRecord(source) ? source['table'] : undefined
  if (form['type'] !== 'form' || typeof table !== 'string' || !Array.isArray(form['fields'])) {
    return []
  }
  const types = columnTypes(config, table)
  if (types === undefined) return []
  return form['fields'].flatMap((entry) => {
    if (!isRecord(entry) || typeof entry['control'] !== 'string') return []
    const { field, control } = entry
    const type = typeof field === 'string' ? types.get(field) : undefined
    if (!TEXT_DRAWN_CONTROLS.has(control) || type === undefined || TEXT_COLUMN_TYPES.has(type)) {
      return []
    }
    return [
      `form on table "${table}": field "${String(field)}" asks for control "${control}", which draws a text box, but the column is ${type}. Remove the control to draw the column as its type, or bind the field to a text column.`,
    ]
  })
}

/**
 * Refuse a table-bound form drawing a non-text column with a text control.
 *
 * @returns one message per offending field, empty otherwise
 */
export function validateTableFormControls(config: unknown): readonly string[] {
  if (!isRecord(config) || !Array.isArray(config['pages'])) return []
  return collectNodes(config['pages']).flatMap((node) => formViolations(config, node))
}
