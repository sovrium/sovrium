/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeTableDialogBodyClasses,
  computeTablePreviewGridCellClasses,
} from '@/presentation/design/table-default-classes'
import { useImportWords } from './import-words'
import type { CsvPreview } from './types'

interface PreviewStepProps {
  readonly preview: CsvPreview
  readonly fileName: string | undefined
}

/** How many of the file's rows the File step shows. */
const PREVIEW_ROWS = 10

/** The separator as the file line names it: a tab has no glyph of its own. */
const separatorName = (separator: CsvPreview['separator']): string =>
  separator === '\t' ? 'tab' : separator

/**
 * The File step once a file is chosen: the file line — its name, how many rows
 * it holds and the separator it was read with — over its first rows.
 */
export function PreviewStep({ preview, fileName }: PreviewStepProps) {
  const t = useImportWords()
  const count = preview.rows.length
  const facts = [
    ...(fileName === undefined ? [] : [fileName]),
    count === 1
      ? t('csvImport.rowCountOne', '{count} row', { count })
      : t('csvImport.rowCount', '{count} rows', { count }),
    t('csvImport.separator', 'separator {separator}', {
      separator: separatorName(preview.separator),
    }),
  ]
  return (
    <div className="space-y-2">
      <p className={computeTableDialogBodyClasses()}>{facts.join(' · ')}</p>
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
            {preview.rows.slice(0, PREVIEW_ROWS).map((row, ri) => (
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
    </div>
  )
}
