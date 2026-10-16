/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { serializeRowsToCsv } from '@/domain/kernel/format/csv-format'
import { buildCsvAttachmentFilename } from '@/domain/kernel/url/csv-attachment'
import type { DataTableInstance } from './table-features'

/**
 * Visible-column id helpers used by the selection export. Kept out of the JSX-bearing files so that the
 * `react-refresh/only-export-components` rule (which forbids mixing helper
 * exports with component exports) stays satisfied.
 */

export function getVisibleColumnIds(table: DataTableInstance): readonly string[] {
  return table
    .getAllColumns()
    .filter((col) => col.id !== 'select' && col.getIsVisible())
    .map((col) => col.id)
}

/**
 * The subject a system-source export is named after: the read endpoint's last
 * path segment.
 *
 * `/api/admin/forms/contact/submissions` names its file `submissions-<date>.csv`
 * rather than `export.csv`, so an operator who exported three console grids can
 * tell the three files apart on disk. Any query string is dropped first — the
 * grid appends paging and sort parameters to the endpoint it reads, and none of
 * them belong in a filename.
 */
export function readEndpointSubject(endpoint: string): string {
  const path = endpoint.split(/[?#]/u)[0] ?? ''
  const segments = path.split('/').filter((segment) => segment.length > 0)
  return segments[segments.length - 1] ?? ''
}

/**
 * Serialise the rows the grid is HOLDING, over the columns still on screen.
 *
 * This is the whole selection export for a system source: there is no table
 * behind such a grid, so no server can be asked to re-read the selection, and
 * the rows in hand are the only rows there are. That is also the limit of it —
 * a selection cannot reach a row on a page the grid never fetched, which is
 * exactly why a DB-table grid keeps going through the records export instead.
 */
export function buildSelectionCsvDownload(
  table: DataTableInstance,
  endpoint: string,
  now: Readonly<Date>
): { readonly csv: string; readonly filename: string } {
  const rows = table.getFilteredSelectedRowModel().rows.map((row) => row.original)
  return {
    csv: serializeRowsToCsv(getVisibleColumnIds(table), rows),
    filename: buildCsvAttachmentFilename(readEndpointSubject(endpoint), now),
  }
}
