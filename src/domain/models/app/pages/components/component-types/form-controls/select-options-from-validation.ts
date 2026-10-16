/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The load-time rules of `optionsFrom` on a choice control, which need the
 * app's tables and so cannot live on the schema node:
 *
 * - a control answers "what can be picked?" ONCE — `optionsFrom` beside
 *   `options` or `dataSource` is refused, naming both keys, since nothing could
 *   say which list the reader is offered;
 * - the field must be one the table declares, and a choice field
 *   (`single-select`, `multi-select` or `status`) — any other declares no
 *   options, so a facet over it would offer nothing.
 *
 * A table taken from the page address (`$param.<segment>`) is decided per
 * request: the request answers 404 when the address names no table, and the
 * field is checked against the table the address names. An unknown table NAME
 * is reported once, by the table-name rule every binding shares.
 */

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The controls that take `optionsFrom`. */
const CHOICE_CONTROLS: ReadonlySet<string> = new Set(['select', 'combobox', 'native-select'])

/** The field types that declare an option list. */
export const CHOICE_FIELD_TYPES: ReadonlySet<string> = new Set([
  'single-select',
  'multi-select',
  'status',
])

/** Every object at any depth, with its location. */
function collectNodes(node: unknown, path: string): readonly (readonly [RawRecord, string])[] {
  if (Array.isArray(node)) {
    return node.flatMap((item, index) => collectNodes(item, `${path}[${String(index)}]`))
  }
  if (!isRecord(node)) return []
  return [
    [node, path],
    ...Object.entries(node).flatMap(([key, child]) =>
      collectNodes(child, path === '' ? key : `${path}.${key}`)
    ),
  ]
}

/** The second answer a control gives beside `optionsFrom`, when it gives one. */
const competingKey = (node: RawRecord): string | undefined =>
  ['options', 'dataSource'].find((key) => node[key] !== undefined)

/** The fields a declared table holds, by name, with their type. */
function tableFields(config: RawRecord, name: string): ReadonlyMap<string, string> | undefined {
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

/** What is wrong with the field one `optionsFrom` names, or nothing. */
function fieldViolation(config: RawRecord, path: string, source: RawRecord): string | undefined {
  const { table, field } = source
  if (typeof table !== 'string' || typeof field !== 'string' || table.startsWith('$param.')) {
    return undefined
  }
  const fields = tableFields(config, table)
  if (fields === undefined) return undefined
  const type = fields.get(field)
  if (type === undefined) {
    return `${path}.optionsFrom.field: '${field}' is not a field of table '${table}'. Name one of its choice fields: ${
      [...fields]
        .filter(([, t]) => CHOICE_FIELD_TYPES.has(t))
        .map(([name]) => name)
        .join(', ') || '(none)'
    }.`
  }
  if (CHOICE_FIELD_TYPES.has(type)) return undefined
  return `${path}.optionsFrom.field: '${field}' of table '${table}' is a ${type} field, which declares no options — a control over it would offer nothing. Name a single-select, multi-select or status field.`
}

/**
 * Every `optionsFrom` rule the config breaks, as finished messages.
 *
 * @param config - The parsed config object, before or after decoding.
 */
export function validateSelectOptionsFrom(config: unknown): readonly string[] {
  if (!isRecord(config)) return []
  const roots = [
    ...collectNodes(config['pages'], 'pages'),
    ...collectNodes(config['components'], 'components'),
  ]
  return roots
    .filter(([node]) => CHOICE_CONTROLS.has(String(node['type'])) && isRecord(node['optionsFrom']))
    .flatMap(([node, path]) => {
      const competing = competingKey(node)
      const both =
        competing === undefined
          ? []
          : [
              `${path}: a ${String(node['type'])} declares both \`optionsFrom\` and \`${competing}\` — keep one: \`optionsFrom\` takes the options a table field declares, \`${competing}\` lists or reads them itself.`,
            ]
      const field = fieldViolation(config, path, node['optionsFrom'] as RawRecord)
      return [...both, ...(field === undefined ? [] : [field])]
    })
}
