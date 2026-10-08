/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeCsvCell } from '@/domain/kernel/format/csv-format'
import type { ColumnMapping, DuplicateStrategy, ImportResult, ValidImportRecord } from './types'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'

interface BuildRecordsFromCsvParams {
  readonly rawContent: string
  readonly editableMappings: readonly ColumnMapping[]
  readonly fieldMeta: FieldMetaMap | undefined
}

interface BuildRecordsResult {
  readonly validRecords: readonly ValidImportRecord[]
  readonly errorRows: readonly { line: string; reason: string }[]
}

/**
 * Apply the column mappings to each data line in the CSV body, partitioning
 * the result into rows that satisfy the required-field constraints
 * (`validRecords`) and rows that don't (`errorRows`).
 */
export function buildRecordsFromCsv(params: BuildRecordsFromCsvParams): BuildRecordsResult {
  const { rawContent, editableMappings, fieldMeta } = params

  const lines = rawContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  const [, ...dataLines] = lines

  const requiredFields = fieldMeta
    ? Object.entries(fieldMeta)
        .filter(([, meta]) => meta.required === true)
        .map(([fieldName]) => fieldName)
    : []

  return dataLines.reduce<{
    validRecords: readonly ValidImportRecord[]
    errorRows: readonly { line: string; reason: string }[]
  }>(
    (acc, line) => {
      const cells = line.split(',').map((c) => c.trim())
      const fields = editableMappings.reduce<Record<string, string>>((fieldAcc, mapping, i) => {
        if (mapping.tableField === undefined) return fieldAcc
        return { ...fieldAcc, [mapping.tableField]: cells[i] ?? '' }
      }, {})
      const missingFields = requiredFields.filter((f) => !fields[f] || fields[f].trim() === '')
      if (missingFields.length > 0) {
        return {
          ...acc,
          errorRows: [
            ...acc.errorRows,
            { line, reason: `Missing required field(s): ${missingFields.join(', ')}` },
          ],
        }
      }
      return { ...acc, validRecords: [...acc.validRecords, { fields }] }
    },
    { validRecords: [], errorRows: [] }
  )
}

/**
 * Build the CSV blob URL for an error report (one row per failed line).
 *
 * The failed line is the imported file's own text, so it goes through the one
 * CSV cell escaper like every other CSV this app writes: a line starting with
 * `=`, `+`, `-` or `@` must open as text in a spreadsheet, not run as a formula.
 */
export function buildErrorReportUrl(
  errorRows: readonly { line: string; reason: string }[]
): string | undefined {
  if (errorRows.length === 0) return undefined
  const csv = [
    'Original Data,error',
    ...errorRows.map(({ line, reason }) => `${escapeCsvCell(line)},${escapeCsvCell(reason)}`),
  ].join('\n')
  return URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
}

/** The most rows one import call carries; a file is sent in chunks of this size. */
const IMPORT_CHUNK = 100

/** What the import route answers for one chunk. */
interface ChunkOutcome {
  readonly created: number
  readonly updated: number
  readonly skipped: number
}

const NOTHING: ChunkOutcome = { created: 0, updated: 0, skipped: 0 }

/**
 * Send one chunk to the table's import route. A chunk the server refuses
 * counts as nothing written.
 */
async function importChunk(
  tableName: string,
  records: readonly ValidImportRecord[],
  strategy: DuplicateStrategy,
  mergeOn: string | undefined
): Promise<ChunkOutcome> {
  const res = await fetch(`/api/tables/${tableName}/records/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records, strategy, ...(mergeOn === undefined ? {} : { mergeOn }) }),
  })
  return res.ok ? ((await res.json()) as ChunkOutcome) : NOTHING
}

interface RunImportParams {
  readonly tableName: string
  readonly validRecords: readonly ValidImportRecord[]
  readonly errorRows: readonly { line: string; reason: string }[]
  readonly duplicateStrategy: DuplicateStrategy
  readonly uniqueField: string | undefined
}

/**
 * Import the rows through the table's import route — the one road an operator
 * can make silent (`import: { fireEvents: false }`) — in chunks, one after the
 * other, and return the combined `ImportResult` (created/updated/skipped/failed
 * + optional error-report URL). The duplicate strategy is applied by the
 * server: `skip` against the records the user may read, `overwrite` as an
 * upsert on the unique field. Without a unique field every row is created.
 */
export async function runImport(params: RunImportParams): Promise<ImportResult> {
  const { tableName, validRecords, errorRows, duplicateStrategy, uniqueField } = params
  const strategy = uniqueField === undefined ? 'create' : duplicateStrategy
  const chunks = Array.from({ length: Math.ceil(validRecords.length / IMPORT_CHUNK) }, (_, i) =>
    validRecords.slice(i * IMPORT_CHUNK, (i + 1) * IMPORT_CHUNK)
  )
  const total = await chunks.reduce<Promise<ChunkOutcome>>(async (previous, chunk) => {
    const sum = await previous
    const outcome = await importChunk(tableName, chunk, strategy, uniqueField)
    return {
      created: sum.created + outcome.created,
      updated: sum.updated + outcome.updated,
      skipped: sum.skipped + outcome.skipped,
    }
  }, Promise.resolve(NOTHING))
  return { ...total, failed: errorRows.length, errorReportUrl: buildErrorReportUrl(errorRows) }
}
