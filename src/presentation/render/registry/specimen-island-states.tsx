/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import {
  syntheticCellText,
  syntheticRowsOf,
  syntheticTitleOf,
} from '@/domain/models/app/pages/synthetic-seed-service'
import { cn } from '@/presentation/design/class-merge'
import {
  computeKanbanBoardClasses,
  computeKanbanColumnClasses,
} from '@/presentation/design/kanban-default-classes'
import { isSpecimenDrawing } from '@/presentation/render/page/specimen-drawing'
import type { Languages } from '@/domain/models/app/languages'
import type { SpecimenFieldShape } from '@/domain/models/app/pages/specimen-sample-service'
import type { Tables } from '@/domain/models/app/tables'
import type { ReactElement } from 'react'

/**
 * What a data island draws in a design-system SPECIMEN, where no island is
 * mounted and nothing is fetched (`specimen-drawing.ts`): never its loading
 * skeleton, which would picture a page that never finishes loading.
 *
 * - A table, a list or a kanban bound to a table the app declares draws the
 *   synthetic seed's rows (`synthetic-seed-service.ts`), the rows a page
 *   export's table draws.
 * - Any other island (a system endpoint, a KPI, a chart, a gallery) draws its
 *   empty state, since the seed cannot type what it would read.
 *
 * On a served page every island keeps its skeleton.
 */

/** A declared table's seed, as an island draws it. */
export interface SpecimenSeed {
  readonly fields: readonly SpecimenFieldShape[]
  readonly rows: readonly Readonly<Record<string, unknown>>[]
}

/**
 * The seed of the declared table a data source reads, in a specimen; nothing
 * on a served page, or for a source naming no declared table.
 */
export const specimenSeedOf = (
  dataSource: unknown,
  tables: Tables | undefined
): SpecimenSeed | undefined => {
  if (!isSpecimenDrawing()) return undefined
  const name = (dataSource as { readonly table?: unknown } | undefined)?.table
  const table = tables?.find((candidate) => candidate.name === name)
  if (table === undefined) return undefined
  const fields = table.fields as readonly SpecimenFieldShape[]
  return { fields, rows: syntheticRowsOf(fields) }
}

/**
 * A data island's server-drawn fallback: its loading skeleton on a served
 * page, what `specimen` draws in a specimen.
 */
export const islandFallback = (
  loading: ReactElement | undefined,
  specimen: () => ReactElement | null | undefined
): ReactElement | null | undefined => (isSpecimenDrawing() ? specimen() : loading)

/** A data island's empty state, in its own words. */
function renderEmptyState(message: string): ReactElement {
  return (
    <div
      data-slot="empty"
      className="text-muted-foreground flex items-center justify-center p-6 text-center text-sm"
    >
      {message}
    </div>
  )
}

/**
 * A data island's empty state, in the words its island writes it (`chart.empty`,
 * `gallery.empty`, …), in the page language.
 */
export const specimenEmpty = (
  key: string,
  currentLang: string | undefined,
  languages: Languages | undefined
): ReactElement => renderEmptyState(resolveInterpreterString(key, currentLang, languages))

/** A single value a specimen cannot type, drawn as the dash an empty field reads. */
export const renderSpecimenDash = (): ReactElement => (
  <span className="text-muted-foreground">—</span>
)

/** The columns a seeded grid heads: those it names, else one per field of its table. */
const seededColumnsOf = (columns: unknown, seed: SpecimenSeed): readonly string[] => {
  const named = (Array.isArray(columns) ? columns : []).flatMap((column) => {
    const field = (column as { readonly field?: unknown } | undefined)?.field
    return typeof field === 'string' ? [field] : []
  })
  return named.length > 0 ? named : seed.fields.map((field) => field.name)
}

/** A seeded grid's headings and rows, as a written table declares them. */
export const seededTableContent = (
  columns: unknown,
  seed: SpecimenSeed
): { readonly tableHeaders: readonly string[]; readonly tableRows: readonly string[][] } => {
  const fields = seededColumnsOf(columns, seed)
  return {
    tableHeaders: fields,
    tableRows: seed.rows.map((row) => fields.map((field) => syntheticCellText(row[field]))),
  }
}

/** A seeded list: one item per row, titled as the row is. */
export function renderSeededListItems(seed: SpecimenSeed): ReactElement {
  return (
    <ul className="flex flex-col gap-2">
      {seed.rows.map((row, index) => (
        <li
          key={`seed-${String(index)}`}
          className="text-sm"
        >
          {syntheticTitleOf(seed.fields, row)}
        </li>
      ))}
    </ul>
  )
}

/** The columns of a seeded board: the group field's values, in the order the rows hold them. */
const boardColumnsOf = (seed: SpecimenSeed, groupField: string | undefined): readonly string[] => [
  ...new Set(seed.rows.map((row) => syntheticCellText(row[groupField ?? '']))),
]

/**
 * A seeded kanban board: a column per value of its group field, holding a card
 * for each row titled as the row is.
 *
 * @param classes - the board's row and the well every column paints with.
 */
export function renderSeededKanbanBoard(
  seed: SpecimenSeed,
  groupField: string | undefined,
  classes: { readonly board: string; readonly column: string }
): ReactElement {
  return (
    <div className={classes.board}>
      {boardColumnsOf(seed, groupField).map((column) => (
        <div
          key={`seed-column-${column}`}
          data-slot="kanban-column"
          className={cn(classes.column, 'w-72 shrink-0')}
        >
          <div className="text-sm font-medium">{column}</div>
          {seed.rows
            .filter((row) => syntheticCellText(row[groupField ?? '']) === column)
            .map((row, index) => (
              <div
                key={`seed-card-${column}-${String(index)}`}
                className="bg-card ring-foreground/10 rounded-xl p-3 text-sm ring-1"
              >
                {syntheticTitleOf(seed.fields, row)}
              </div>
            ))}
        </div>
      ))}
    </div>
  )
}

/**
 * The kanban in a design-system specimen, where no island mounts: the seeded
 * rows of its declared table as cards in a column per value of its group
 * field, else its empty state.
 */
export function renderKanbanSpecimen(
  elementProps: Record<string, unknown>,
  tables: Tables | undefined,
  text: { readonly languages?: Languages | undefined; readonly locale?: string | undefined }
): ReactElement {
  const seed = specimenSeedOf(elementProps.dataSource, tables)
  if (seed === undefined) return specimenEmpty('kanban.empty', text.locale, text.languages)
  const groupBy = elementProps.kanbanGroupBy as { readonly field?: string } | undefined
  return renderSeededKanbanBoard(seed, groupBy?.field, {
    board: computeKanbanBoardClasses(),
    column: computeKanbanColumnClasses(),
  })
}
