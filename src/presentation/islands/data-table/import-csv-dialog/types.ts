/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** The separators a CSV file is read with. */
export type CsvSeparator = ',' | ';' | '\t'

export type CsvPreview = {
  readonly headers: readonly string[]
  /** Every data row of the file, split into cells. */
  readonly rows: readonly (readonly string[])[]
  readonly separator: CsvSeparator
}

/**
 * Where each value of a choice column goes, by column index: a value the field
 * has no option for, mapped to the option chosen for it (`''` stores nothing).
 */
export type ValueMappings = Readonly<Record<number, Readonly<Record<string, string>>>>

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
