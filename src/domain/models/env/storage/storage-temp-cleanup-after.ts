/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `STORAGE_TEMP_CLEANUP_AFTER` env var — the age at which a file written to
 * automation temp storage (`tmp/automations/`) becomes eligible for removal,
 * in milliseconds.
 *
 * It is an age threshold (TTL), not an interval: nothing schedules a sweep.
 * Temp files are reclaimed opportunistically by the next temp-storage write,
 * so this value answers "how old must a temp file be before a sweep may take
 * it", never "how often does a sweep run".
 *
 * `0` opts out of app-level sweeping entirely — for operators who delegate
 * reclamation to a storage-side lifecycle rule (e.g. an S3 bucket policy).
 */
export const DEFAULT_STORAGE_TEMP_CLEANUP_AFTER_MS = 86_400_000

/**
 * Resolve `STORAGE_TEMP_CLEANUP_AFTER` from a snapshot of env vars.
 *
 * - unset / empty          → 24 hours (the shipped default)
 * - `'0'`                  → `0` (sweeping disabled)
 * - positive integer       → the integer as-is
 * - negative / non-integer → 24 hours (a malformed value must not silently
 *   disable reclamation, which would reintroduce the unbounded-growth bug)
 */
export const parseStorageTempCleanupAfter = (
  processEnv: Readonly<Record<string, string | undefined>>
): number => {
  const raw = processEnv['STORAGE_TEMP_CLEANUP_AFTER']?.trim()
  if (raw === undefined || raw === '') return DEFAULT_STORAGE_TEMP_CLEANUP_AFTER_MS
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_STORAGE_TEMP_CLEANUP_AFTER_MS
  return parsed
}
