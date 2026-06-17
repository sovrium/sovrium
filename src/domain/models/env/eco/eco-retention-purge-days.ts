/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const DEFAULT_ECO_RETENTION_PURGE_DAYS: number | undefined = undefined

export const parseEcoRetentionPurgeDays = (
  processEnv: Readonly<Record<string, string | undefined>>
): number | undefined => {
  const raw = processEnv['ECO_RETENTION_PURGE_DAYS']?.trim()
  if (raw === undefined || raw === '') return DEFAULT_ECO_RETENTION_PURGE_DAYS
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_ECO_RETENTION_PURGE_DAYS
  return parsed
}
