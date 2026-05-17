/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { partitionDuplicatesForSkip } from './parser'
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

/** Build the CSV blob URL for an error report (one row per failed line). */
export function buildErrorReportUrl(
  errorRows: readonly { line: string; reason: string }[]
): string | undefined {
  if (errorRows.length === 0) return undefined
  const csv = [
    'Original Data,error',
    ...errorRows.map(
      ({ line, reason }) => `"${line.replace(/"/g, '""')}","${reason.replace(/"/g, '""')}"`
    ),
  ].join('\n')
  return URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
}

/**
 * Issue the upsert call for the overwrite strategy.
 *
 * Returns `{ created, updated }` from the response, or zeros if no records
 * needed to be sent or the call failed.
 */
async function upsertRecords(
  tableName: string,
  validRecords: readonly ValidImportRecord[],
  uniqueField: string
): Promise<{ created: number; updated: number }> {
  if (validRecords.length === 0) return { created: 0, updated: 0 }
  const upsertRes = await fetch(`/api/tables/${tableName}/records/upsert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records: validRecords, fieldsToMergeOn: [uniqueField] }),
  })
  if (!upsertRes.ok) return { created: 0, updated: 0 }
  return (await upsertRes.json()) as { created: number; updated: number }
}

/** Issue the batch-create call for the create/skip strategies. */
async function batchCreateRecords(
  tableName: string,
  recordsToCreate: readonly ValidImportRecord[]
): Promise<number> {
  if (recordsToCreate.length === 0) return 0
  const res = await fetch(`/api/tables/${tableName}/records/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records: recordsToCreate }),
  })
  return res.ok ? recordsToCreate.length : 0
}

interface RunImportParams {
  readonly tableName: string
  readonly validRecords: readonly ValidImportRecord[]
  readonly errorRows: readonly { line: string; reason: string }[]
  readonly duplicateStrategy: DuplicateStrategy
  readonly uniqueField: string | undefined
}

/**
 * Execute the configured duplicate strategy against the records API and
 * return the combined `ImportResult` (created/updated/skipped/failed +
 * optional error-report URL).
 *
 * `overwrite` uses the upsert API; `skip` partitions client-side then POSTs
 * the surviving rows; `create` always POSTs everything.
 */
export async function runImport(params: RunImportParams): Promise<ImportResult> {
  const { tableName, validRecords, errorRows, duplicateStrategy, uniqueField } = params

  const errorReportUrl = buildErrorReportUrl(errorRows)

  if (duplicateStrategy === 'overwrite' && uniqueField !== undefined) {
    const { created, updated } = await upsertRecords(tableName, validRecords, uniqueField)
    return { created, updated, skipped: 0, failed: errorRows.length, errorReportUrl }
  }

  // Skip-duplicates is implemented client-side: fetch existing records once,
  // filter the CSV against the chosen unique field, then only POST the new
  // rows. v1 design — fine for the table sizes Sovrium currently supports.
  // A server-side variant should land before this hits production-scale
  // imports, since one fetch of all records won't scale.
  const { keep: recordsToCreate, skipped } =
    duplicateStrategy === 'skip' && uniqueField !== undefined
      ? await partitionDuplicatesForSkip({ tableName, uniqueField, validRecords })
      : { keep: validRecords, skipped: 0 }

  const created = await batchCreateRecords(tableName, recordsToCreate)
  return { created, updated: 0, skipped, failed: errorRows.length, errorReportUrl }
}
