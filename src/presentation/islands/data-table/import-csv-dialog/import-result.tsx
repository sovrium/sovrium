/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ImportResult as ImportResultData } from './types'

interface ImportResultProps {
  readonly result: ImportResultData
}

function CreatedLine({ result }: ImportResultProps) {
  if (result.created === 0) return undefined
  const isCreateOnly = result.skipped === 0 && result.updated === 0
  if (isCreateOnly) {
    return <p className="text-success-fg text-sm">{result.created} records imported successfully</p>
  }
  return <p className="text-success-fg text-sm">{result.created} records created</p>
}

export function ImportResultView({ result }: ImportResultProps) {
  return (
    <div className="mt-4 space-y-2">
      <CreatedLine result={result} />
      {result.updated > 0 && (
        <p className="text-info-fg text-sm">{result.updated} records updated</p>
      )}
      {result.skipped > 0 && (
        <p className="text-warning-fg text-sm">{result.skipped} records skipped (duplicates)</p>
      )}
      {result.failed > 0 && <p className="text-error-fg text-sm">{result.failed} records failed</p>}
      {result.errorReportUrl && (
        <a
          href={result.errorReportUrl}
          download="error-report.csv"
          className="text-primary inline-block text-sm underline hover:opacity-80"
        >
          Download error report
        </a>
      )}
    </div>
  )
}
