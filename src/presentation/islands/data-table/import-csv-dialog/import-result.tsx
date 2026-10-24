/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useImportWord } from './import-words'
import type { ImportResult as ImportResultData } from './types'

interface ImportResultProps {
  readonly result: ImportResultData
}

/**
 * Render the "X records created" line.
 *
 * For the create-only path with no skip/update bookkeeping, the plain
 * "X records imported" confirmation. The breakdown form is only shown when
 * skip/overwrite strategies actually partition the result.
 */
function CreatedLine({ result }: ImportResultProps) {
  const count = { count: result.created }
  const imported = useImportWord('csvImport.imported', '{count} records imported', count)
  const created = useImportWord('csvImport.created', '{count} records created', count)
  if (result.created === 0) return undefined
  const isCreateOnly = result.skipped === 0 && result.updated === 0
  return <p className="text-success-fg text-sm">{isCreateOnly ? imported : created}</p>
}

export function ImportResultView({ result }: ImportResultProps) {
  const updated = useImportWord('csvImport.updated', '{count} records updated', {
    count: result.updated,
  })
  const skipped = useImportWord('csvImport.skipped', '{count} records skipped (duplicates)', {
    count: result.skipped,
  })
  const failed = useImportWord('csvImport.failed', '{count} records failed', {
    count: result.failed,
  })
  const report = useImportWord('csvImport.errorReport', 'Download error report')
  return (
    <div className="space-y-2">
      <CreatedLine result={result} />
      {result.updated > 0 && <p className="text-info-fg text-sm">{updated}</p>}
      {result.skipped > 0 && <p className="text-warning-fg text-sm">{skipped}</p>}
      {result.failed > 0 && <p className="text-error-fg text-sm">{failed}</p>}
      {result.errorReportUrl && (
        <a
          href={result.errorReportUrl}
          download="error-report.csv"
          className="text-primary inline-block text-sm underline hover:opacity-80"
        >
          {report}
        </a>
      )}
    </div>
  )
}
