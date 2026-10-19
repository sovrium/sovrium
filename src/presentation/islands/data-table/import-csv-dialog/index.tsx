/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { computeDialogOverlayClasses } from '@/presentation/design/dialog-default-classes'
import {
  computeTableDialogPanelClasses,
  computeTableDialogPositionerClasses,
  computeTableDialogTitleClasses,
} from '@/presentation/design/table-default-classes'
import { DialogFooter } from './dialog-footer'
import { DuplicateStep } from './duplicate-step'
import { ImportResultView } from './import-result'
import { useImportWord } from './import-words'
import { MappingStep } from './mapping-step'
import { matchHeaderToField, type FieldLabelCandidates } from './parser'
import { PreviewStep } from './preview-step'
import { UploadStep } from './upload-step'
import { runImport, buildRecordsFromCsv } from './use-import'
import { useImportCsvDialogState } from './use-state'
import { WizardSteps } from './wizard-steps'
import type { ColumnMapping, ImportResult } from './types'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'

interface ImportCsvDialogProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly tableFields?: readonly string[]
  readonly tableName: string
  readonly fieldMeta?: FieldMetaMap
  /** Each field's label in every language the app declares, for the auto-mapping. */
  readonly fieldLabels?: FieldLabelCandidates
  /** Called once the rows were written, with what the import created. */
  readonly onImported?: (result: ImportResult) => void
}

/**
 * Compute the per-column mapping bag from a fresh CSV preview, attempting to
 * auto-resolve each header to a table field by its name, its label in any
 * declared language, or the words it shares with a field name.
 */
function buildInitialMappings(
  headers: readonly string[],
  tableFields: readonly string[] | undefined,
  fieldLabels: FieldLabelCandidates | undefined
): readonly ColumnMapping[] {
  return headers.map((header) => ({
    csvColumn: header,
    tableField: matchHeaderToField(header, tableFields, fieldLabels),
  }))
}

/**
 * Compute the list of required fields that the user has not yet mapped to a
 * CSV column. The mapping step displays a warning row per entry.
 */
function getUnmappedRequiredFields(
  step: string,
  fieldMeta: FieldMetaMap | undefined,
  editableMappings: readonly ColumnMapping[]
): readonly string[] {
  if (step !== 'mapping' || !fieldMeta) return []
  const mappedFieldSet = new Set(
    editableMappings.flatMap((m) => (m.tableField !== undefined ? [m.tableField] : []))
  )
  return Object.entries(fieldMeta)
    .filter(([, meta]) => meta.required === true)
    .map(([name]) => name)
    .filter((name) => !mappedFieldSet.has(name))
}

export function ImportCsvDialog({
  open,
  onClose,
  tableFields,
  tableName,
  fieldMeta,
  fieldLabels,
  onImported,
}: ImportCsvDialogProps) {
  const state = useImportCsvDialogState()
  const title = useImportWord('csvImport.title', 'Import CSV')
  const importing = useImportWord('csvImport.importing', 'Importing records')

  const onPreviewNext = useCallback(() => {
    state.setEditableMappings(
      buildInitialMappings(state.preview?.headers ?? [], tableFields, fieldLabels)
    )
    state.setStep('mapping')
  }, [state, tableFields, fieldLabels])

  const onMappingNext = useCallback(() => state.setStep('duplicate-handling'), [state])

  const onImport = useCallback(() => {
    void (async () => {
      if (!state.rawContent || state.editableMappings.length === 0) return
      const { validRecords, errorRows } = buildRecordsFromCsv({
        rawContent: state.rawContent,
        editableMappings: state.editableMappings,
        fieldMeta,
        separator: state.preview?.separator ?? ',',
        valueMappings: state.valueMappings,
      })
      if (validRecords.length === 0 && errorRows.length === 0) return

      state.setIsImporting(true)
      try {
        const result = await runImport({
          tableName,
          validRecords,
          errorRows,
          duplicateStrategy: state.duplicateStrategy,
          uniqueField: state.uniqueField,
        })
        state.setImportResult(result)
        onImported?.(result)
      } finally {
        state.setIsImporting(false)
      }
    })()
  }, [state, fieldMeta, tableName, onImported])

  if (!open) return undefined

  const unmappedRequiredFields = getUnmappedRequiredFields(
    state.step,
    fieldMeta,
    state.editableMappings
  )

  return (
    <>
      <div
        data-slot="dialog-overlay"
        className={computeDialogOverlayClasses()}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-csv-dialog-title"
        className={computeTableDialogPositionerClasses()}
      >
        <div
          data-slot="dialog-content"
          className={computeTableDialogPanelClasses({ width: 'grid' })}
        >
          <h2
            id="import-csv-dialog-title"
            data-slot="dialog-title"
            className={computeTableDialogTitleClasses()}
          >
            {title}
          </h2>
          <WizardSteps step={state.step} />
          {state.step === 'upload' && (
            <UploadStep
              noDataError={state.noDataError}
              onFileChange={state.onFileChange}
            />
          )}
          {state.step === 'preview' && state.preview && (
            <PreviewStep
              preview={state.preview}
              fileName={state.fileName}
            />
          )}
          {state.step === 'mapping' && (
            <MappingStep
              editableMappings={state.editableMappings}
              preview={state.preview}
              tableFields={tableFields}
              fieldMeta={fieldMeta}
              valueMappings={state.valueMappings}
              onValueMappingChange={state.updateValueMapping}
              hoveredColumnIndex={state.hoveredColumnIndex}
              unmappedRequiredFields={unmappedRequiredFields}
              onMouseEnter={state.onMouseEnter}
              onMouseLeave={state.onMouseLeave}
              onMappingChange={state.updateMapping}
            />
          )}
          {state.step === 'duplicate-handling' && !state.importResult && (
            <DuplicateStep
              duplicateStrategy={state.duplicateStrategy}
              setDuplicateStrategy={state.setDuplicateStrategy}
              uniqueField={state.uniqueField}
              setUniqueField={state.setUniqueField}
              tableFields={tableFields}
              fieldMeta={fieldMeta}
            />
          )}
          {state.isImporting && (
            <div>
              <progress
                className="w-full"
                aria-label={importing}
              />
            </div>
          )}
          {state.importResult && <ImportResultView result={state.importResult} />}
          <DialogFooter
            step={state.step}
            preview={state.preview}
            importResult={state.importResult}
            isImporting={state.isImporting}
            onClose={onClose}
            onPreviewNext={onPreviewNext}
            onMappingNext={onMappingNext}
            onImport={onImport}
          />
        </div>
      </div>
    </>
  )
}
