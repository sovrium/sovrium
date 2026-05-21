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
  readonly parsed: ParsedTsv
  readonly mismatchMatrix: readonly (readonly boolean[])[]
}

function PreviewCell({ value, mismatch }: { readonly value: string; readonly mismatch: boolean }) {
  if (!mismatch) {
    return <td className="px-3 py-2 text-gray-800">{value}</td>
  }
  return (
    <td
      data-mismatch="true"
      className="group relative bg-red-600 px-3 py-2 text-white"
    >
      {value}
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full left-1/2 z-10 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        {TYPE_MISMATCH_MESSAGE}
      </span>
    </td>
  )
}

export function PreviewRows({ parsed, mismatchMatrix }: PreviewRowsProps) {
  const previewRows = parsed.rows.slice(0, PREVIEW_ROW_LIMIT)
  return (
    <tbody className="divide-y divide-gray-100">
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
