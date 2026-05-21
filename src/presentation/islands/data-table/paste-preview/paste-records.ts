/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { matchHeaderToField } from '../import-csv-dialog/parser'
import { isCellTypeMismatch } from './cell-mismatch'
import { SKIP_VALUE } from './skip-value'
import type { ParsedTsv } from './parse-tsv'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'

export function buildInitialMappings(
  headers: readonly string[],
  tableFields: readonly string[]
): readonly string[] {
  return headers.map((header) => matchHeaderToField(header, tableFields) ?? SKIP_VALUE)
}

export function buildRecords(
  parsed: ParsedTsv,
  mappings: readonly string[],
  fieldMeta?: FieldMetaMap
): readonly { fields: Record<string, string> }[] {
  return parsed.rows.map((row) => {
    const fields = mappings.reduce<Record<string, string>>((acc, target, columnIndex) => {
      if (target === SKIP_VALUE) return acc
      const value = row[columnIndex] ?? ''
      if (isCellTypeMismatch(value, fieldMeta?.[target]?.type)) return acc
      return { ...acc, [target]: value }
    }, {})
    return { fields }
  })
}

export interface PasteCreateResult {
  readonly created: number
  readonly recordIds: readonly string[]
}

export async function batchCreatePastedRecords(
  tableName: string,
  records: readonly { fields: Record<string, string> }[]
): Promise<PasteCreateResult> {
  if (records.length === 0) return { created: 0, recordIds: [] }
  const response = await fetch(`/api/tables/${tableName}/records/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records, returnRecords: true }),
  }).catch(() => undefined)
  if (!response || !response.ok) return { created: records.length, recordIds: [] }
  const body = (await response.json().catch(() => undefined)) as
    | { created?: number; records?: { id?: string | number }[] }
    | undefined
  const recordIds = (body?.records ?? [])
    .map((r) => (r.id === undefined ? '' : String(r.id)))
    .filter((id) => id.length > 0)
  return { created: body?.created ?? records.length, recordIds }
}

const DELETE_CHUNK_SIZE = 100

export async function undoPastedRecords(
  tableName: string,
  recordIds: readonly string[]
): Promise<void> {
  if (recordIds.length === 0) return
  const chunkCount = Math.ceil(recordIds.length / DELETE_CHUNK_SIZE)
  const chunks = Array.from({ length: chunkCount }, (_, i) =>
    recordIds.slice(i * DELETE_CHUNK_SIZE, (i + 1) * DELETE_CHUNK_SIZE)
  )
  await Promise.all(
    chunks.map((ids) =>
      fetch(`/api/tables/${tableName}/records/batch/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      }).catch(() => undefined)
    )
  )
}
