/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { DialogFooter } from './dialog-footer'
import { DuplicateStep } from './duplicate-step'
import { ImportResultView } from './import-result'
import { MappingStep } from './mapping-step'
import { matchHeaderToField } from './parser'
import { PreviewStep } from './preview-step'
import { UploadStep } from './upload-step'
import { runImport, buildRecordsFromCsv } from './use-import'
import { useImportCsvDialogState } from './use-state'
import type { ColumnMapping } from './types'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'

interface ImportCsvDialogProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly tableFields?: readonly string[]
  readonly tableName: string
  readonly fieldMeta?: FieldMetaMap
}

/**
 * Compute the per-column mapping bag from a fresh CSV preview, attempting to
 * auto-resolve each header to the closest table field via token overlap.
 */
function buildInitialMappings(
  headers: readonly string[],
  tableFields: readonly string[] | undefined
): readonly ColumnMapping[] {
  return headers.map((header) => ({
    csvColumn: header,
    tableField: matchHeaderToField(header, tableFields),
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

// eslint-disable-next-line max-lines-per-function -- dialog shell wires per-step components together via state machine; further splits would scatter the step-transition contract across files
export function ImportCsvDialog({
  open,
  onClose,
  tableFields,
  tableName,
  fieldMeta,
}: ImportCsvDialogProps) {
  const state = useImportCsvDialogState()

  // eslint-disable-next-line no-restricted-syntax -- needed to satisfy react-perf/jsx-no-new-function-as-prop; React Compiler not yet enabled in Bun (see docs/infrastructure/ui/react.md)
  const onPreviewNext = useCallback(() => {
    state.setEditableMappings(buildInitialMappings(state.preview?.headers ?? [], tableFields))
    state.setStep('mapping')
  }, [state, tableFields])

  // eslint-disable-next-line no-restricted-syntax -- needed to satisfy react-perf/jsx-no-new-function-as-prop; React Compiler not yet enabled in Bun (see docs/infrastructure/ui/react.md)
  const onMappingNext = useCallback(() => state.setStep('duplicate-handling'), [state])

  // eslint-disable-next-line no-restricted-syntax -- needed to satisfy react-perf/jsx-no-new-function-as-prop; React Compiler not yet enabled in Bun (see docs/infrastructure/ui/react.md)
  const onImport = useCallback(() => {
    void (async () => {
      if (!state.rawContent || state.editableMappings.length === 0) return
      const { validRecords, errorRows } = buildRecordsFromCsv({
        rawContent: state.rawContent,
        editableMappings: state.editableMappings,
        fieldMeta,
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
      } finally {
        state.setIsImporting(false)
      }
    })()
  }, [state, fieldMeta, tableName])

  if (!open) return undefined

  const unmappedRequiredFields = getUnmappedRequiredFields(
    state.step,
    fieldMeta,
    state.editableMappings
  )

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-csv-dialog-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
          <h2
            id="import-csv-dialog-title"
            className="mb-4 text-lg font-semibold text-gray-900"
          >
            Import CSV
          </h2>
          {state.step === 'upload' && (
            <UploadStep
              noDataError={state.noDataError}
              onFileChange={state.onFileChange}
            />
          )}
          {state.step === 'preview' && state.preview && <PreviewStep preview={state.preview} />}
          {state.step === 'mapping' && (
            <MappingStep
              editableMappings={state.editableMappings}
              preview={state.preview}
              tableFields={tableFields}
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
            />
          )}
          {state.isImporting && (
            <div className="mt-4">
              <progress
                className="w-full"
                aria-label="Importing records"
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
