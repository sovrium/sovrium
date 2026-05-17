/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import { parseCsvPreview } from './parser'
import type {
  ColumnMapping,
  CsvPreview,
  DuplicateStrategy,
  ImportResult,
  ImportWizardStep,
} from './types'

interface FileReadCallbacks {
  readonly onParsed: (preview: CsvPreview, rawContent: string) => void
  readonly onEmpty: () => void
}

/**
 * Read a CSV file with the FileReader API and dispatch to the appropriate
 * callback based on whether the parsed result has any data rows.
 */
function readCsvFile(file: File, callbacks: FileReadCallbacks): void {
  const reader = new FileReader()
  reader.addEventListener('load', (event: ProgressEvent<FileReader>) => {
    const content = event.target?.result
    if (typeof content !== 'string') return
    const parsed = parseCsvPreview(content)
    if (parsed.rows.length === 0) {
      callbacks.onEmpty()
    } else {
      callbacks.onParsed(parsed, content)
    }
  })
  reader.readAsText(file)
}

/**
 * Local state machine for the import wizard.
 *
 * Owns: file content + preview, current step, editable column mappings,
 * import result, in-flight flag, duplicate strategy + unique-field choice,
 * and the hovered-column index used to position the sample-values tooltip.
 *
 * Returned as a flat bag so the dialog can pass individual fields directly
 * to the per-step components without prop drilling through a single context.
 */
// eslint-disable-next-line max-lines-per-function -- wizard state machine: 10 useState + 5 useCallback are the entire purpose of this hook; further splitting would require multiple bag hooks and a composition shim
export function useImportCsvDialogState() {
  const [preview, setPreview] = useState<CsvPreview | undefined>(undefined)
  const [rawContent, setRawContent] = useState<string | undefined>(undefined)
  const [noDataError, setNoDataError] = useState(false)
  const [step, setStep] = useState<ImportWizardStep>('upload')
  const [editableMappings, setEditableMappings] = useState<readonly ColumnMapping[]>([])
  const [importResult, setImportResult] = useState<ImportResult | undefined>(undefined)
  const [isImporting, setIsImporting] = useState(false)
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('create')
  const [uniqueField, setUniqueField] = useState<string | undefined>(undefined)
  const [hoveredColumnIndex, setHoveredColumnIndex] = useState<number | undefined>(undefined)

  const updateMapping = useCallback((index: number, tableField: string | undefined) => {
    setEditableMappings((prev) => prev.map((m, i) => (i === index ? { ...m, tableField } : m)))
  }, [])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    readCsvFile(file, {
      onParsed: (parsed, content) => {
        setPreview(parsed)
        setRawContent(content)
        setNoDataError(false)
        setStep('preview')
      },
      onEmpty: () => {
        setNoDataError(true)
        setPreview(undefined)
        setRawContent(undefined)
        setStep('upload')
      },
    })
  }, [])

  const onMouseEnter = useCallback((index: number) => setHoveredColumnIndex(index), [])
  const onMouseLeave = useCallback(() => setHoveredColumnIndex(undefined), [])

  return {
    preview,
    rawContent,
    noDataError,
    step,
    setStep,
    editableMappings,
    setEditableMappings,
    importResult,
    setImportResult,
    isImporting,
    setIsImporting,
    duplicateStrategy,
    setDuplicateStrategy,
    uniqueField,
    setUniqueField,
    hoveredColumnIndex,
    updateMapping,
    onFileChange,
    onMouseEnter,
    onMouseLeave,
  }
}
