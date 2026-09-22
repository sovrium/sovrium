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
 * Below 1024 bytes the raw count is suffixed with `B`; larger values are
 * ROUNDED into the next binary unit, so the result is always an integer plus a
 * unit. A non-finite input renders `0 B` rather than `NaN B`.
 */
export function formatByteCount(bytes: number): string {
  if (!Number.isFinite(bytes)) return '0 B'
  if (bytes < 1024) return `${String(bytes)} B`
  if (bytes < 1024 * 1024) return `${String(Math.round(bytes / 1024))} KB`
  if (bytes < 1024 * 1024 * 1024) return `${String(Math.round(bytes / (1024 * 1024)))} MB`
  return `${String(Math.round(bytes / (1024 * 1024 * 1024)))} GB`
}
