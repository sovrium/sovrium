/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'

interface ActiveFilter {
  readonly field: string
  readonly value: string
}

type FilterStep = 'field' | 'value'

export function useDataTableUiState() {
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({})
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [filterOverlayOpen, setFilterOverlayOpen] = useState(false)
  const [filterStep, setFilterStep] = useState<FilterStep>('field')
  const [filterField, setFilterField] = useState<string | undefined>(undefined)
  const [activeFilter, setActiveFilter] = useState<ActiveFilter | undefined>(undefined)

  const onOpenImportDialog = useCallback(() => setImportDialogOpen(true), [])
  const onCloseImportDialog = useCallback(() => setImportDialogOpen(false), [])
  const onOpenFilterOverlay = useCallback(() => {
    setFilterStep('field')
    setFilterField(undefined)
    setFilterOverlayOpen(true)
  }, [])
  const onToggleColumnsMenu = useCallback(() => setColumnsMenuOpen((prev) => !prev), [])
  const onToggleExportMenu = useCallback(() => setExportMenuOpen((prev) => !prev), [])
  const onCloseExportMenu = useCallback(() => setExportMenuOpen(false), [])
  const onFieldSelect = useCallback((field: string) => {
    setFilterField(field)
    setFilterStep('value')
  }, [])
  const onValueSelect = useCallback((filter: ActiveFilter) => {
    setActiveFilter(filter)
    setFilterOverlayOpen(false)
  }, [])

  return {
    columnVisibility,
    setColumnVisibility,
    columnsMenuOpen,
    onToggleColumnsMenu,
    exportMenuOpen,
    onToggleExportMenu,
    onCloseExportMenu,
    importDialogOpen,
    onOpenImportDialog,
    onCloseImportDialog,
    filterOverlayOpen,
    onOpenFilterOverlay,
    filterStep,
    filterField,
    onFieldSelect,
    onValueSelect,
    activeFilter,
  }
}
