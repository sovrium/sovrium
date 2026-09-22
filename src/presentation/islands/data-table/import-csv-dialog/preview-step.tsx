/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeTablePreviewGridCellClasses } from '@/presentation/design/table-default-classes'
import type { CsvPreview } from './types'

interface PreviewStepProps {
  readonly preview: CsvPreview
}

export function PreviewStep({ preview }: PreviewStepProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            {preview.headers.map((header, i) => (
              <th
                key={i}
                className={computeTablePreviewGridCellClasses({ kind: 'header' })}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={computeTablePreviewGridCellClasses({ kind: 'data' })}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
