/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `ECO_RETENTION_PURGE_DAYS` env var — default soft-deleted-row purge horizon
 * for tables that opt in.
 *
 * `undefined` means "manual retention only" (no automatic purge). A positive
 * integer enables the purge horizon platform-wide as a fallback; per-table
 * retention overrides still win.
 *
 * The dashboard surfaces this value verbatim so operators see the effective
 * platform horizon at a glance. The API contract maps `undefined` → JSON
 * `null` (the wire-format encoding for "no retention horizon").
 */
export const DEFAULT_ECO_RETENTION_PURGE_DAYS: number | undefined = undefined

/**
 * Resolve `ECO_RETENTION_PURGE_DAYS` from a snapshot of env vars.
 *
 * - unset / empty           → `undefined` (manual retention; no automatic purge)
 * - `'0'` / non-integer raw → `undefined` (operator explicitly disabled purge)
 * - positive integer        → the integer as-is
 */
export const parseEcoRetentionPurgeDays = (
  processEnv: Readonly<Record<string, string | undefined>>
): number | undefined => {
  const raw = processEnv['ECO_RETENTION_PURGE_DAYS']?.trim()
  if (raw === undefined || raw === '') return DEFAULT_ECO_RETENTION_PURGE_DAYS
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_ECO_RETENTION_PURGE_DAYS
  return parsed
}
