/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { TYPE_MISMATCH_MESSAGE } from './cell-mismatch'
import { PREVIEW_ROW_LIMIT } from './skip-value'
import type { ParsedTsv } from './parse-tsv'

interface PreviewRowsProps {
  /** Parsed clipboard data; only the first {@link PREVIEW_ROW_LIMIT} rows render. */
  readonly parsed: ParsedTsv
  /**
   * Row-aligned matrix flagging cells whose value mismatches the mapped field
   * type. Index-aligned with `parsed.rows` then `parsed.headers`.
   */
  readonly mismatchMatrix: readonly (readonly boolean[])[]
}

/** Renders a single preview cell, mismatched or normal. */
function PreviewCell({ value, mismatch }: { readonly value: string; readonly mismatch: boolean }) {
  if (!mismatch) {
    return <td className="text-foreground px-3 py-2">{value}</td>
  }
  return (
    <td
      data-mismatch="true"
      className="group bg-error-solid text-error-solid-fg relative px-3 py-2"
    >
      {value}
      <span
        role="tooltip"
        className="bg-foreground text-background pointer-events-none absolute top-full left-1/2 z-10 -translate-x-1/2 rounded px-2 py-1 text-xs whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100"
      >
        {TYPE_MISMATCH_MESSAGE}
      </span>
    </td>
  )
}

/**
 * The `<tbody>` of the paste-preview table — the first
 * {@link PREVIEW_ROW_LIMIT} pasted data rows, aligned to the header columns.
 *
 * Cells whose value is incompatible with the mapped field type are flagged
 * with `data-mismatch="true"`, a red background, and a hover tooltip so the
 * user sees the problem before confirming the import.
 */
export function PreviewRows({ parsed, mismatchMatrix }: PreviewRowsProps) {
  const previewRows = parsed.rows.slice(0, PREVIEW_ROW_LIMIT)
  return (
    <tbody className="divide-border divide-y">
      {previewRows.map((row, rowIndex) => (
        <tr key={`row-${rowIndex}`}>
          {parsed.headers.map((_, columnIndex) => (
            <PreviewCell
              key={`cell-${rowIndex}-${columnIndex}`}
              value={row[columnIndex] ?? ''}
              mismatch={mismatchMatrix[rowIndex]?.[columnIndex] ?? false}
            />
          ))}
        </tr>
      ))}
    </tbody>
  )
}
