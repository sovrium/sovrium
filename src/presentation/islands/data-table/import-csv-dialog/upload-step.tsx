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
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        No data rows found
      </div>
    )
  }
  return (
    <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
      <p className="mb-4 text-sm text-gray-600">Drag and drop a CSV file here</p>
      <label className="cursor-pointer">
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={onFileChange}
        />
        <span className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
          Browse file
        </span>
      </label>
    </div>
  )
}
