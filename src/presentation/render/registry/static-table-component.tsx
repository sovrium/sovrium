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

import {
  computeStaticTableCellClasses,
  computeStaticTableHeaderRowClasses,
  computeStaticTableShellClasses,
} from '../../design/display-default-classes'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'

/** The header row, or nothing when the author declared no `tableHeaders`. */
const staticHead = (headers: readonly string[]) => {
  if (headers.length === 0) return undefined
  const cellClass = computeStaticTableCellClasses({ kind: 'header' })
  return (
    <thead>
      <tr className={computeStaticTableHeaderRowClasses()}>
        {headers.map((header, i) => (
          <th
            key={i}
            className={cellClass}
          >
            {header}
          </th>
        ))}
      </tr>
    </thead>
  )
}

/** The body rows, or nothing when the author declared no `tableRows`. */
const staticBody = (rows: ReadonlyArray<readonly string[]>) => {
  if (rows.length === 0) return undefined
  const cellClass = computeStaticTableCellClasses({ kind: 'data' })
  return (
    <tbody>
      {rows.map((row, ri) => (
        <tr key={ri}>
          {row.map((cell, ci) => (
            <td
              key={ci}
              className={cellClass}
            >
              {cell}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

/** Render the rows an author wrote in the config as a plain `<table>`. */
export const staticTableComponent: ComponentRenderer = ({ elementPropsWithSpacing, component }) => {
  const tableComp = component as
    | {
        tableHeaders?: readonly string[]
        tableRows?: ReadonlyArray<readonly string[]>
      }
    | undefined
  const headers = tableComp?.tableHeaders ?? []
  const rows = tableComp?.tableRows ?? []
  const {
    'data-testid': dataTestId,
    className: authorClassName,
    ...restProps
  } = elementPropsWithSpacing
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
      {staticHead(headers)}
      {staticBody(rows)}
    </table>
  )
}
