/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

interface UploadStepProps {
  readonly noDataError: boolean
  readonly onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function UploadStep({ noDataError, onFileChange }: UploadStepProps) {
  if (noDataError) {
    return (
      <div className="border-error-border bg-error-bg text-error-fg rounded border p-4 text-sm">
        No data rows found
      </div>
    )
  }
  return (
    <div className="border-border rounded-lg border-2 border-dashed p-8 text-center">
      <p className="text-fg-muted mb-4 text-sm">Drag and drop a CSV file here</p>
      <label className="cursor-pointer">
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={onFileChange}
        />
        <span className="bg-primary text-primary-fg hover:bg-primary-hover rounded px-4 py-2 text-sm">
          Browse file
        </span>
      </label>
    </div>
  )
}
