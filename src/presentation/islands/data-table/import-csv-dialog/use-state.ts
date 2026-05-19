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
