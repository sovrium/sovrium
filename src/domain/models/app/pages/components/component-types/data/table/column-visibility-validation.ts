/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A grid must start with at least one field column drawn. `visible: 'hidden'`
 * starts a column unchecked under View › Hide fields, and a grid whose every
 * field column starts that way would arrive with no data column at all — rows
 * with nothing in them, and no column a reader could read them by. Judged on
 * the parsed config, since each column alone is valid. Pure: no I/O.
 */

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Every object at any depth, with its location. */
function collectNodes(node: unknown, path: string): readonly (readonly [RawRecord, string])[] {
  if (Array.isArray(node)) {
    return node.flatMap((item, index) => collectNodes(item, `${path}[${String(index)}]`))
  }
  if (!isRecord(node)) return []
  return [
    [node, path],
    ...Object.entries(node).flatMap(([key, child]) => collectNodes(child, `${path}.${key}`)),
  ]
}

/** The field columns a node declares: the entries of its `columns` naming a `field`. */
const fieldColumnsOf = (node: RawRecord): readonly RawRecord[] => {
  const { columns } = node
  if (!Array.isArray(columns)) return []
  return columns.filter(
    (column: unknown): column is RawRecord =>
      isRecord(column) && typeof column['field'] === 'string'
  )
}

/** Whether every field column a node declares starts hidden — and there is one. */
const startsWithNoColumn = (node: RawRecord): boolean => {
  const fields = fieldColumnsOf(node).filter((column) => column['visible'] !== false)
  return fields.length > 0 && fields.every((column) => column['visible'] === 'hidden')
}

/**
 * Every grid whose field columns all start `visible: 'hidden'`.
 *
 * @returns one message per refusal; empty when every grid draws a column
 */
export function validateColumnVisibility(config: unknown): readonly string[] {
  if (!isRecord(config)) return []
  return collectNodes(config['pages'], 'pages').flatMap(([node, path]) =>
    startsWithNoColumn(node)
      ? [
          `${path}.columns: every field column is declared \`visible: 'hidden'\`, so the grid would arrive with no column drawn. Draw at least one: leave its \`visible\` out, or set it to \`true\`.`,
        ]
      : []
  )
}
