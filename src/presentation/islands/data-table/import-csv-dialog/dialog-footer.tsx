/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { computeTableEditorFooterClasses } from '@/presentation/design/table-default-classes'
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
    <div className={computeTableEditorFooterClasses()}>
      {step === 'preview' && preview && (
        <button
          type="button"
          className={computeButtonDefaultClasses({ variant: 'default', size: 'sm' })}
          onClick={onPreviewNext}
        >
          Next
        </button>
      )}
      {step === 'mapping' && !importResult && (
        <>
          <button
            type="button"
            className={computeButtonDefaultClasses({ variant: 'default', size: 'sm' })}
            onClick={onMappingNext}
          >
            Next
          </button>
          <button
            type="button"
            className={computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })}
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
          className={computeButtonDefaultClasses({ variant: 'default', size: 'sm' })}
          disabled={isImporting}
          onClick={onImport}
        >
          Import
        </button>
      )}
      <button
        type="button"
        className={computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })}
        onClick={onClose}
      >
        Cancel
      </button>
    </div>
  )
}
