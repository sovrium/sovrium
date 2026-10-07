/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Cap on `error` field length surfaced to the trigger response and
 * persisted to `system.automation_runs.error` — guards against a
 * misbehaving upstream inflating run-history payloads.
 */
export const MAX_ERROR_LENGTH = 500
const TRUNCATION_SUFFIX = '… (truncated)'

/**
 * Truncate AFTER redaction. If we truncated first and the secret straddled
 * the cut point, redaction would not match the literal string and a partial
 * secret could leak into history. Always: redact -> truncate.
 *
 * @internal — exported for unit tests; production callers go through
 * `redactString` which composes redaction + truncation in the correct order.
 */
export const truncateError = (input: string): string => {
  if (input.length <= MAX_ERROR_LENGTH) return input
  return input.slice(0, MAX_ERROR_LENGTH) + TRUNCATION_SUFFIX
}
