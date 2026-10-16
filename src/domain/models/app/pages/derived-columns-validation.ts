/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a grid's `columnsFrom` can actually read, judged on one page.
 *
 * `columnsFrom: 'table'` derives one column per declared field of the bound
 * table, which is what makes a records grid over ANY table one page definition
 * rather than one per table. It needs a DB-table binding: a system source
 * describes an endpoint's shape rather than a declared table, so there are no
 * fields to derive from and the grid would render no columns at all — the
 * silent failure this refuses. And it is exclusive with an authored `columns`:
 * table-derived columns cover the whole row, so an authored one beside them
 * could only duplicate one.
 *
 * `columnsFrom: { form }` derives the ANSWER columns of a form over its
 * submissions. Answers live in a submission row's `body`, which only a system
 * source over a form's submissions carries — a table's rows have none — so it
 * needs a `dataSource.system`. Authored `columns` may stand beside it: they are
 * the envelope (status, received time), which the derivation never covers.
 *
 * Pure: no I/O.
 */

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The rules of `columnsFrom: 'table'`. */
const tableSourceViolations = (node: RawRecord, label: string): readonly string[] => {
  const { dataSource } = node
  const boundToTable = isRecord(dataSource) && typeof dataSource['table'] === 'string'
  return [
    ...(node['columns'] !== undefined
      ? [
          `${label} declares a data-table with both columns and columnsFrom — keep one: authored columns OR columns derived from the bound table`,
        ]
      : []),
    ...(boundToTable
      ? []
      : [
          `${label} declares columnsFrom without a dataSource.table — a system source describes an endpoint's shape, not a declared table, so there are no fields to derive columns from`,
        ]),
  ]
}

/** The rule of `columnsFrom: { form }`. */
const formSourceViolations = (node: RawRecord, label: string): readonly string[] => {
  const { dataSource } = node
  return isRecord(dataSource) && dataSource['system'] !== undefined
    ? []
    : [
        `${label} declares columnsFrom: { form } without a dataSource.system — a form's answers are read from its submissions' body, which a table's rows do not carry; bind the grid to the form's submissions list`,
      ]
}

/**
 * Every `columnsFrom` on the page that cannot be honoured.
 *
 * @param nodes - every object node of the page
 * @param label - how the page is named in a message
 */
export function derivedColumnViolations(
  nodes: readonly RawRecord[],
  label: string
): readonly string[] {
  return nodes.flatMap((node) => {
    const source = node['columnsFrom']
    if (source === undefined) return []
    return isRecord(source) ? formSourceViolations(node, label) : tableSourceViolations(node, label)
  })
}
