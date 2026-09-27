/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { optionValue, type SelectOptionLike } from '@/domain/models/app/tables/select-option'
import { readDisplayLabel } from '../runtime/record-display-label'
import type { DataTableRow } from './island/table-features'

/** One grouping level, resolved: the field it partitions on and how it reads. */
export interface GroupLevel {
  readonly field: string
  /** Order of THIS level's headers. Independent of every other level's. */
  readonly direction?: 'asc' | 'desc'
  /** Declared option order of this level's field, when it declares one. */
  readonly declaredOptions?: readonly SelectOptionLike[]
  /** Whether this level's groups start folded. */
  readonly collapsed?: boolean
}

/**
 * One rendered group: its own value, the ancestor path that names it uniquely,
 * and either the sub-groups nested inside it or the data rows it holds.
 *
 * `children` and `dataRows` are mutually exclusive by construction — rows hang
 * off the INNERMOST level only, because that is the level whose partition is
 * fine enough to describe them.
 */
export interface GroupNode {
  /** This group's own value, stringified. The group's IDENTITY — keys, paths, counts. */
  readonly value: string
  /**
   * What the header reads. A relationship whose table declares a `displayField`
   * names the related record ("Acme Robotics"); every other field reads its value.
   */
  readonly label: string
  /** The value before stringification — kept for `data-group-value`. */
  readonly rawValue: unknown
  /** Ancestor values, outermost first, ending in this group's own. */
  readonly path: readonly string[]
  /** 1 for the primary level, 2 and 3 for the nested ones. */
  readonly level: number
  readonly children: readonly GroupNode[]
  readonly dataRows: readonly DataTableRow[]
  /** Rows of the LOADED PAGE in this group, at any depth beneath it. */
  readonly pageRowCount: number
}

/**
 * The key a group is addressed by, at every level and on both sides of the wire.
 *
 * A JSON array rather than a delimited string: any delimiter can appear inside a
 * field value, and a group called `EMEA / West` must not read as two levels.
 * With one level this is `["EMEA"]` — still a path, so the client keys nested
 * and un-nested grids the same way and there is only one lookup to get right.
 */
export function groupPathKey(path: readonly string[]): string {
  return JSON.stringify(path)
}

/** The value one row carries at one grouping level, stringified as the server does. */
function rowValueAt(row: DataTableRow, field: string): string {
  const raw = (row.original as Record<string, unknown>)[field]
  return raw === null || raw === undefined ? '' : String(raw)
}

/**
 * The header a group reads: the related record's resolved label when the row
 * carries one for this field, the value itself otherwise. Only a to-one label
 * names a group — a to-many field's value is a link SET, not one record.
 */
function labelAt(row: DataTableRow | undefined, field: string, value: string): string {
  const display = row ? readDisplayLabel(row.original, field) : undefined
  return typeof display === 'string' && display !== '' ? display : value
}

/** Orders two header strings. */
type CompareGroupText = (a: string, b: string) => number

/**
 * The comparison for group values that carry no declared order, in the PAGE
 * locale — the one the grid's cells already format in — rather than the
 * browser's default, since collation differs by language (a Swedish page sorts
 * "Örebro" after "Zeta"; an English one sorts it beside "Oslo"). Numeric-aware
 * so a grouping on a bare number renders 2 before 10.
 */
function groupTextComparator(locale: string): CompareGroupText {
  return new Intl.Collator(locale, { numeric: true }).compare
}

/**
 * Order group values by the option order their field DECLARES, appending any
 * value the field never declared (a legacy row, a value written before the
 * option was removed) after the declared ones, alphabetically.
 */
function orderByDeclaredOptions(
  values: readonly string[],
  declaredOptions: readonly SelectOptionLike[],
  compare: CompareGroupText
): readonly string[] {
  const rank = new Map(declaredOptions.map((option, index) => [optionValue(option), index]))
  const declared = values
    .filter((value) => rank.has(value))
    .toSorted((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0))
  const undeclared = values.filter((value) => !rank.has(value)).toSorted(compare)
  return [...declared, ...undeclared]
}

/**
 * Order the group HEADERS of ONE level.
 *
 * Three rules, in priority order:
 *
 *  1. **A field that declares options is ordered by those options.** A sales
 *     pipeline declares `Prospect → Qualified → Negotiation → Won` because that
 *     order carries meaning; sorting those headers by value would open the grid
 *     on "Negotiation". Kanban already reads a declaration this way
 *     (`resolveKanbanGroupByOptions`), and a grid and a board grouped on the
 *     same field must not disagree about that field's order.
 *  2. **Otherwise an explicit `direction` sorts by what the header READS**,
 *     numeric-aware — the related record's label for a labelled relationship,
 *     the value for everything else; the key breaks a tie between two records
 *     sharing a label, so they stay two groups in a stable order.
 *  3. **Otherwise the encounter order is left alone** — with no declaration and
 *     no stated preference there is nothing to honour, and reordering would
 *     only churn the runtime Group menu's output.
 *
 * `desc` reverses whichever ordering rule 1 or 2 produced, so it means "last to
 * first" for a declared pipeline exactly as it does for a plain value sort.
 *
 * The rule belongs to the FIELD, not to the depth, so this runs unchanged at
 * every level — with that level's own `direction` and that level's own field's
 * declared options. An inner `desc` therefore cannot reverse the level above it.
 */
function orderGroupValues(
  values: readonly string[],
  level: GroupLevel,
  labelOf: (value: string) => string,
  compare: CompareGroupText
): readonly string[] {
  const { direction, declaredOptions } = level
  const ordered =
    declaredOptions && declaredOptions.length > 0
      ? orderByDeclaredOptions(values, declaredOptions, compare)
      : direction === undefined
        ? values
        : values.toSorted((a, b) => compare(labelOf(a), labelOf(b)) || compare(a, b))
  return direction === 'desc' ? ordered.toReversed() : ordered
}

/**
 * Distinct values at one level, in the order the rows first present them, each
 * with the first row carrying it — the row its header label is read from.
 *
 * One pass each way, no per-value rebuild: the `Set` keeps first-encounter
 * order, and feeding the pairs to a `Map` in REVERSE lets the first row of each
 * value be the last one written, so it is the one that stays.
 */
function distinctFirstRows(
  rows: readonly DataTableRow[],
  field: string
): ReadonlyMap<string, DataTableRow> {
  const pairs = rows.map((row) => [rowValueAt(row, field), row] as const)
  const firstRowOf = new Map(pairs.toReversed())
  const order = new Set(pairs.map(([value]) => value))
  return new Map(
    [...order].flatMap((value) => {
      const row = firstRowOf.get(value)
      return row ? [[value, row] as const] : []
    })
  )
}

/**
 * Partition the loaded page's rows into the nested group tree the body renders.
 *
 * The tree is built from the ROWS rather than from TanStack's grouped row model
 * so that a level may name a field the grid does not show as a column: the value
 * is read off the record, and the group header is what carries it to the reader.
 * That rule is the primary level's already, and making a nested level stricter
 * than the level above it would be incoherent.
 *
 * Only groups with a row on the loaded page appear. A header reading `Won (1)`
 * above an empty body is a worse answer than its absence — the grid's rows and
 * its group headers must describe the same set. The NUMBERS inside those headers
 * come from the server's whole-view partition, so they stay put across paging.
 */
export function buildGroupTree(
  rows: readonly DataTableRow[],
  levels: readonly GroupLevel[],
  locale: string
): readonly GroupNode[] {
  return buildLevel(rows, levels, [], groupTextComparator(locale))
}

function buildLevel(
  rows: readonly DataTableRow[],
  levels: readonly GroupLevel[],
  parentPath: readonly string[],
  compare: CompareGroupText
): readonly GroupNode[] {
  const level = levels[parentPath.length]
  if (!level) return []
  const firstRows = distinctFirstRows(rows, level.field)
  const labelOf = (value: string): string => labelAt(firstRows.get(value), level.field, value)
  const ordered = orderGroupValues([...firstRows.keys()], level, labelOf, compare)
  return ordered.map((value) => {
    const members = rows.filter((row) => rowValueAt(row, level.field) === value)
    const path = [...parentPath, value]
    const children = buildLevel(members, levels, path, compare)
    return {
      value,
      label: labelOf(value),
      rawValue: (members[0]?.original as Record<string, unknown> | undefined)?.[level.field],
      path,
      level: path.length,
      children,
      dataRows: children.length > 0 ? [] : members,
      pageRowCount: members.length,
    }
  })
}
