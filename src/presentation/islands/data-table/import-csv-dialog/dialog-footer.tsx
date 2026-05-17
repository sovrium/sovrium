/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ImportResult, ImportWizardStep, CsvPreview } from './types'

interface DialogFooterProps {
  readonly step: ImportWizardStep
  readonly preview: CsvPreview | undefined
  readonly importResult: ImportResult | undefined
  readonly isImporting: boolean
  readonly onClose: () => void
  readonly onPreviewNext: () => void
  readonly onMappingNext: () => void
  readonly onImport: () => void
}

export function DialogFooter({
  step,
  preview,
  importResult,
  isImporting,
  onClose,
  onPreviewNext,
  onMappingNext,
  onImport,
}: DialogFooterProps) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      {step === 'preview' && preview && (
        <button
          type="button"
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          onClick={onPreviewNext}
        >
          Next
        </button>
      )}
      {step === 'mapping' && !importResult && (
        <>
          <button
            type="button"
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            onClick={onMappingNext}
          >
            Next
          </button>
          <button
            type="button"
            className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            disabled={isImporting}
            onClick={onImport}
          >
            Import
          </button>
        </>
      )}
      {step === 'duplicate-handling' && !importResult && (
        <button
          type="button"
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          disabled={isImporting}
          onClick={onImport}
        >
          Import
        </button>
      )}
      <button
        type="button"
        className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        onClick={onClose}
      >
        Cancel
      </button>
    </div>
  )
}
