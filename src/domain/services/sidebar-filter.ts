/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { substituteRecordVars } from '@/domain/utils/substitute-record-vars'

export { substituteRecordVars }

export interface ResolvedSidebarEntry {
  readonly recordId: string
  readonly label: string
  readonly href: string
  readonly active: boolean
}

export interface SidebarTemplateConfig {
  readonly label: string
  readonly href: string
  readonly archivedField?: string
}

export const isArchivedRecord = (
  record: Readonly<Record<string, unknown>>,
  archivedField: string | undefined
): boolean => {
  if (!archivedField) return false
  const value = record[archivedField]
  if (value === undefined || value === null) return false
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    return (
      value !== '' &&
      value !== '0' &&
      value.toLowerCase() !== 'f' &&
      value.toLowerCase() !== 'false'
    )
  }
  return Boolean(value)
}

export const resolveSidebarEntries = (
  records: readonly Readonly<Record<string, unknown>>[],
  template: SidebarTemplateConfig,
  options: { readonly activeRecordId?: string; readonly idField?: string } = {}
): readonly ResolvedSidebarEntry[] => {
  const { activeRecordId, idField = 'id' } = options
  return records
    .filter((record) => !isArchivedRecord(record, template.archivedField))
    .map((record) => {
      const rawId = record[idField]
      const recordId = rawId === undefined || rawId === null ? '' : String(rawId)
      return {
        recordId,
        label: substituteRecordVars(template.label, record),
        href: substituteRecordVars(template.href, record),
        active:
          activeRecordId !== undefined && activeRecordId !== '' && recordId === activeRecordId,
      }
    })
}
