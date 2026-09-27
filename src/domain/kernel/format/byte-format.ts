/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * THE byte formatter. One function, one module, no other import.
 *
 * It is deliberately NOT co-located with the rest of `cell-value-format.ts`.
 * A KPI tile needs only this arithmetic, while `formatCellValue` reaches
 * `currency-format` and the whole `ColumnFormat` ladder behind it — folding the
 * two together cost the KPI island 1.9 KB of mount weight for code it never
 * calls, which the island payload budget caught on the commit that did it.
 *
 * Both consumers land here, so a KPI tile (`kpiFormat: { type: 'bytes' }`) and
 * a column or `record-field` declaring `format: 'bytes'` cannot print the same
 * number two ways on the same page.
 *
 * Below 1024 bytes the raw count is suffixed with `B` and never carries a
 * fraction. Larger values move into the next binary unit and keep ONE decimal
 * while they are below 10 in that unit — `1.5 MB`, `9.8 KB` — because rounding
 * `1.5 MB` to `2 MB` misstates it by a third; at 10 and above the integer is
 * precise enough (`12 MB`). A trailing `.0` is dropped (`1 KB`, not `1.0 KB`).
 * A non-finite input renders `0 B` rather than `NaN B`.
 */
const UNITS = [
  { unit: 'KB', size: 1024 },
  { unit: 'MB', size: 1024 * 1024 },
  { unit: 'GB', size: 1024 * 1024 * 1024 },
] as const

const scaled = (value: number): string => {
  const oneDecimal = Math.round(value * 10) / 10
  return oneDecimal < 10 ? String(oneDecimal) : String(Math.round(value))
}

export function formatByteCount(bytes: number): string {
  if (!Number.isFinite(bytes)) return '0 B'
  if (bytes < 1024) return `${String(Math.round(bytes))} B`
  const { unit, size } = UNITS.findLast((candidate) => bytes >= candidate.size) ?? UNITS[0]
  return `${scaled(bytes / size)} ${unit}`
}
