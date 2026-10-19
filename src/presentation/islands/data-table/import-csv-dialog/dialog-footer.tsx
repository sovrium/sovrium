/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { computeTableEditorFooterClasses } from '@/presentation/design/table-default-classes'
import { useImportWord } from './import-words'
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

/** One footer button: the primary fill or the secondary one. */
function FooterButton({
  variant,
  disabled,
  onClick,
  children,
}: {
  readonly variant: 'default' | 'secondary'
  readonly disabled?: boolean
  readonly onClick: () => void
  readonly children: string
}) {
  return (
    <button
      type="button"
      className={computeButtonDefaultClasses({ variant, size: 'sm' })}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
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
  const next = useImportWord('csvImport.next', 'Next')
  const importLabel = useImportWord('csvImport.import', 'Import')
  const done = useImportWord('csvImport.done', 'Done')
  const cancel = useImportWord('csvImport.cancel', 'Cancel')
  return (
    <div className={computeTableEditorFooterClasses()}>
      {step === 'preview' && preview && (
        <FooterButton
          variant="default"
          onClick={onPreviewNext}
        >
          {next}
        </FooterButton>
      )}
      {step === 'mapping' && !importResult && (
        <>
          <FooterButton
            variant="default"
            onClick={onMappingNext}
          >
            {next}
          </FooterButton>
          <FooterButton
            variant="secondary"
            disabled={isImporting}
            onClick={onImport}
          >
            {importLabel}
          </FooterButton>
        </>
      )}
      {step === 'duplicate-handling' && !importResult && (
        <FooterButton
          variant="default"
          disabled={isImporting}
          onClick={onImport}
        >
          {importLabel}
        </FooterButton>
      )}
      <FooterButton
        variant="secondary"
        onClick={onClose}
      >
        {importResult ? done : cancel}
      </FooterButton>
    </div>
  )
}
