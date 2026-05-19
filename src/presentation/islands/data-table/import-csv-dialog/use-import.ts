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

export async function runImport(params: RunImportParams): Promise<ImportResult> {
  const { tableName, validRecords, errorRows, duplicateStrategy, uniqueField } = params

  const errorReportUrl = buildErrorReportUrl(errorRows)

  if (duplicateStrategy === 'overwrite' && uniqueField !== undefined) {
    const { created, updated } = await upsertRecords(tableName, validRecords, uniqueField)
    return { created, updated, skipped: 0, failed: errorRows.length, errorReportUrl }
  }

  const { keep: recordsToCreate, skipped } =
    duplicateStrategy === 'skip' && uniqueField !== undefined
      ? await partitionDuplicatesForSkip({ tableName, uniqueField, validRecords })
      : { keep: validRecords, skipped: 0 }

  const created = await batchCreateRecords(tableName, recordsToCreate)
  return { created, updated: 0, skipped, failed: errorRows.length, errorReportUrl }
}
