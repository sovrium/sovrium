/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `table` that binds nothing: the STATIC half of the merged type.
 *
 * Prestyled-by-default and purely presentational — no island, no
 * fetch, no hydration. The author ships `tableHeaders` + `tableRows` as inline
 * literal arrays and gets a bordered, rounded table with subtle header chrome.
 *
 * ─── WHY ITS OWN MODULE ────────────────────────────────────────────────────
 *
 * `static-table` and `data-table` merged into one `table` literal, so ONE
 * registry entry now serves both modes and has to choose between them. That
 * entry lives beside the bound renderer in `island-data-components.tsx`,
 * because the bound mode is the one that carries the island. Lifting the static
 * markup here rather than inlining it there keeps that file under the 300-line
 * cap React modules are held to, and keeps the two modes readable as two
 * things — which is what they still are. Only the name the author writes is
 * one.
 *
 * The className composes through {@link mergePrestyle} (defaults → author
 * override) so `props.className` appends after the prestyled defaults at the
 * Tailwind cascade.
 */

import { cn } from '../../design/class-merge'
import {
  computeStaticTableCellClasses,
  computeStaticTableHeaderRowClasses,
  computeStaticTableShellClasses,
} from '../../design/display-default-classes'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'

/** How one written column is drawn — `tableColumns[i]`, index-aligned with the headers. */
interface StaticColumn {
  readonly align?: 'left' | 'center' | 'right'
  readonly className?: string
}

/** The parts a written table draws inside itself, by name. */
interface StaticTableParts {
  readonly caption?: string
  readonly header?: string
  readonly row?: string
  readonly cell?: string
}

const ALIGN_CLASS: Readonly<Record<NonNullable<StaticColumn['align']>, string>> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

const alignOf = (column: StaticColumn | undefined): string | undefined =>
  column?.align === undefined ? undefined : ALIGN_CLASS[column.align]

/** The header row, or nothing when the author declared no `tableHeaders`. */
const staticHead = (
  headers: readonly string[],
  columns: readonly StaticColumn[],
  parts: StaticTableParts
) => {
  if (headers.length === 0) return undefined
  const cellClass = computeStaticTableCellClasses({ kind: 'header' })
  return (
    <thead>
      <tr className={computeStaticTableHeaderRowClasses()}>
        {headers.map((header, i) => (
          <th
            key={i}
            className={cn(cellClass, parts.header, alignOf(columns[i]))}
          >
            {header}
          </th>
        ))}
      </tr>
    </thead>
  )
}

/** The body rows, or nothing when the author declared no `tableRows`. */
const staticBody = (
  rows: ReadonlyArray<readonly string[]>,
  columns: readonly StaticColumn[],
  parts: StaticTableParts
) => {
  if (rows.length === 0) return undefined
  const cellClass = computeStaticTableCellClasses({ kind: 'data' })
  return (
    <tbody>
      {rows.map((row, ri) => (
        <tr
          key={ri}
          className={parts.row}
        >
          {row.map((cell, ci) => (
            <td
              key={ci}
              className={cn(cellClass, parts.cell, alignOf(columns[ci]), columns[ci]?.className)}
            >
              {cell}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

/** The table's `caption` — its accessible name — with the author's `caption` part classes. */
const STATIC_CAPTION_CLASSES = 'py-2 text-left text-sm text-foreground-muted'
const staticCaption = (caption: string | undefined, part: string | undefined) =>
  caption === undefined || caption === '' ? undefined : (
    <caption className={cn(STATIC_CAPTION_CLASSES, part)}>{caption}</caption>
  )

/** What a written table declares, each list empty when absent. */
interface StaticTableContent {
  readonly headers: readonly string[]
  readonly rows: ReadonlyArray<readonly string[]>
  readonly columns: readonly StaticColumn[]
  readonly caption: string | undefined
}

const staticTableContent = (component: unknown): StaticTableContent => {
  const declared = (component ?? {}) as {
    readonly tableHeaders?: readonly string[]
    readonly tableRows?: ReadonlyArray<readonly string[]>
    readonly caption?: string
    readonly tableColumns?: readonly StaticColumn[]
  }
  return {
    headers: declared.tableHeaders ?? [],
    rows: declared.tableRows ?? [],
    columns: declared.tableColumns ?? [],
    caption: declared.caption,
  }
}

/** Render the rows an author wrote in the config as a plain `<table>`. */
export const staticTableComponent: ComponentRenderer = ({
  elementPropsWithSpacing,
  component,
  designStyles,
}) => {
  const { headers, rows, columns, caption } = staticTableContent(component)
  const parts: StaticTableParts = designStyles?.parts ?? {}
  const {
    'data-testid': dataTestId,
    className: authorClassName,
    ...restProps
  } = omitInternalMarkers(elementPropsWithSpacing)
  const mergedClassName = mergePrestyle(
    computeStaticTableShellClasses(),
    authorClassName as string | undefined
  )
  return (
    <table
      {...restProps}
      data-testid={dataTestId as string | undefined}
      className={mergedClassName}
    >
      {staticCaption(caption, parts.caption)}
      {staticHead(headers, columns, parts)}
      {staticBody(rows, columns, parts)}
    </table>
  )
}
