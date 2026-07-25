/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const DEFAULT_STORAGE_TEMP_CLEANUP_AFTER_MS = 86_400_000

export const parseStorageTempCleanupAfter = (
  processEnv: Readonly<Record<string, string | undefined>>
): number => {
  const raw = processEnv['STORAGE_TEMP_CLEANUP_AFTER']?.trim()
  if (raw === undefined || raw === '') return DEFAULT_STORAGE_TEMP_CLEANUP_AFTER_MS
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_STORAGE_TEMP_CLEANUP_AFTER_MS
  return parsed
}
