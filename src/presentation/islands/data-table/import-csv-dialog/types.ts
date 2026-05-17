/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export type CsvPreview = {
  readonly headers: readonly string[]
  readonly rows: readonly (readonly string[])[]
}

export type ImportWizardStep = 'upload' | 'preview' | 'mapping' | 'duplicate-handling'

export type DuplicateStrategy = 'skip' | 'overwrite' | 'create'

export type ColumnMapping = {
  readonly csvColumn: string
  readonly tableField: string | undefined
}

export type ValidImportRecord = { fields: Record<string, string> }

export type ImportResult = {
  created: number
  skipped: number
  updated: number
  failed: number
  errorReportUrl?: string
}
