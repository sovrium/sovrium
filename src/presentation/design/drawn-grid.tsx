/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeStaticTableBodyClasses,
  computeStaticTableCellClasses,
  computeStaticTableContainerClasses,
  computeStaticTableRowClasses,
  computeStaticTableShellClasses,
} from './display-default-classes'
import { DRAWN_ROWS_STYLE } from './drawn-rows-style'
import type { ReactElement } from 'react'

/** A grid's first page as the server read it for its reader: its headings, and each row's text. */
export interface DrawnGridPage {
  readonly headings: readonly string[]
  readonly rows: readonly (readonly string[])[]
}

/** The drawn grid's heading row. */
function DrawnHeadings({ headings }: { readonly headings: readonly string[] }): ReactElement {
  return (
    <div
      data-slot="table-header"
      className="table-header-group"
    >
      <div
        data-slot="table-row"
        className={`table-row ${computeStaticTableRowClasses()}`}
      >
        {headings.map((heading, index) => (
          <div
            key={`head-${String(index)}`}
            data-slot="table-head"
            className={`table-cell ${computeStaticTableCellClasses({ kind: 'header' })}`}
          >
            {heading}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * A grid's first page as text, drawn the same by the server before the grid
 * mounts and by the mounted grid until its own read answers: the placeholder's
 * anatomy, its cells holding the text each row prints, so the browser's find
 * and a print reach the rows. It is a placeholder, not the grid: no `<table>`,
 * no row or cell role, no control. Those remain the sign the grid is live, and
 * arrive with the rows its read returns, decorated and wired to their records.
 */
export function DrawnGrid({ headings, rows }: DrawnGridPage): ReactElement {
  return (
    <div
      data-slot="table-container"
      className={computeStaticTableContainerClasses()}
      style={DRAWN_ROWS_STYLE}
    >
      <div
        data-slot="table"
        className={`table ${computeStaticTableShellClasses()}`}
      >
        <DrawnHeadings headings={headings} />
        <div
          data-slot="table-body"
          className={`table-row-group ${computeStaticTableBodyClasses()}`}
        >
          {rows.map((cells, rowIndex) => (
            <div
              key={`row-${String(rowIndex)}`}
              data-slot="table-row"
              className={`table-row ${computeStaticTableRowClasses()}`}
            >
              {cells.map((text, cellIndex) => (
                <div
                  key={`cell-${String(cellIndex)}`}
                  data-slot="table-cell"
                  className={`table-cell ${computeStaticTableCellClasses({ kind: 'data' })}`}
                >
                  {text}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
