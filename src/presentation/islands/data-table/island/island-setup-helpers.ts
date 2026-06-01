/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { evaluatePredicate } from './filter-operators'
import type { FilterConjunction, FilterRow } from './use-ui-state'
import type { TableRecord } from '../../shared/types'
import type { AutoSaveConfig } from '@/domain/models/app/pages/components/auto-save'
import type {
  DataTableColumn,
  DataTableSearch,
  DataTableToolbar,
} from '@/domain/models/app/pages/components/data-table'

export function resolveEditableFields(
  columnConfig: readonly DataTableColumn[] | undefined
): readonly string[] {
  if (!columnConfig) return []
  return columnConfig
    .filter((col): col is Extract<DataTableColumn, { field: string }> => 'field' in col)
    .filter((col) => col.editable === true)
    .map((col) => col.field)
}

export function shouldShowSearch(
  searchConfig: DataTableSearch | undefined,
  toolbarConfig: DataTableToolbar | undefined
): boolean {
  return !!(
    (searchConfig && searchConfig.enabled !== false) ||
    (toolbarConfig && toolbarConfig.search)
  )
}

export interface SaveIndicatorSettings {
  readonly show: boolean
  readonly position: 'inline' | 'toast' | 'toolbar'
}

export function resolveSaveIndicator(
  autoSaveConfig: AutoSaveConfig | undefined
): SaveIndicatorSettings | undefined {
  if (!autoSaveConfig) return undefined
  const mode = autoSaveConfig.saveMode ?? 'manual'
  if (mode === 'manual') return undefined
  const show = autoSaveConfig.showSaveIndicator !== false
  return { show, position: autoSaveConfig.saveIndicatorPosition ?? 'inline' }
}

export function applyClientFilters(
  records: readonly TableRecord[],
  activeFilters: readonly FilterRow[],
  conjunction: FilterConjunction
): readonly TableRecord[] {
  if (activeFilters.length === 0) return records
  return records.filter((record) => {
    const row = record as Record<string, unknown>
    if (conjunction === 'OR') {
      return activeFilters.some((f) => evaluatePredicate(row[f.field], f.operator, f.value))
    }
    return activeFilters.every((f) => evaluatePredicate(row[f.field], f.operator, f.value))
  })
}
