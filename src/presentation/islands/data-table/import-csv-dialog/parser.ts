/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { CsvPreview, ValidImportRecord } from './types'

export function parseCsvPreview(content: string): CsvPreview {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  const [headerLine, ...dataLines] = lines
  const headers = (headerLine ?? '').split(',').map((h) => h.trim())
  const rows = dataLines.slice(0, 10).map((line) => line.split(',').map((cell) => cell.trim()))
  return { headers, rows }
}

function tokenize(s: string): readonly string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0)
}

export function matchHeaderToField(
  header: string,
  tableFields: readonly string[] | undefined
): string | undefined {
  if (!tableFields || tableFields.length === 0) return undefined

  const exact = tableFields.find((f) => f.toLowerCase() === header.toLowerCase())
  if (exact !== undefined) return exact

  const headerTokens = new Set(tokenize(header))
  if (headerTokens.size === 0) return undefined

  const candidates = tableFields
    .map((field) => {
      const fieldTokens = tokenize(field)
      const overlap = fieldTokens.reduce((acc, t) => (headerTokens.has(t) ? acc + 1 : acc), 0)
      return { field, overlap }
    })
    .filter((s) => s.overlap > 0)

  const best = candidates.reduce<{ field: string; overlap: number } | undefined>((acc, cur) => {
    if (acc === undefined) return cur
    if (cur.overlap > acc.overlap) return cur
    if (cur.overlap === acc.overlap && cur.field.localeCompare(acc.field) < 0) return cur
    return acc
  }, undefined)

  return best?.field
}

export async function partitionDuplicatesForSkip(args: {
  tableName: string
  uniqueField: string
  validRecords: readonly ValidImportRecord[]
}): Promise<{ keep: readonly ValidImportRecord[]; skipped: number }> {
  const { tableName, uniqueField, validRecords } = args
  const existingRes = await fetch(`/api/tables/${tableName}/records?page=1&limit=100`)
  const parsed = existingRes.ok
    ? ((await existingRes.json()) as {
        records?: readonly { fields?: Record<string, unknown> }[]
      })
    : { records: [] }
  const existingValues = new Set<string>(
    (parsed.records ?? [])
      .map((r) => r.fields?.[uniqueField])
      .filter((v): v is string | number => v !== undefined && v !== null)
      .map((v) => String(v))
  )
  return validRecords.reduce<{ keep: readonly ValidImportRecord[]; skipped: number }>(
    (acc, record) => {
      const key = record.fields[uniqueField]
      if (key !== undefined && existingValues.has(key)) {
        return { keep: acc.keep, skipped: acc.skipped + 1 }
      }
      return { keep: [...acc.keep, record], skipped: acc.skipped }
    },
    { keep: [], skipped: 0 }
  )
}
