/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** Maximum allowed length for a model-identifier string. */
export const MAX_MODEL_STRING_LENGTH = 128

/**
 * Result of validating a model-identifier string. `ok: true` carries no
 * payload (the trimmed value is the caller's responsibility); `ok: false`
 * carries an operator-facing message.
 */
export type ModelStringValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string }

/**
 * Validate a model-identifier string (e.g. the `AI_MODEL` env var or an
 * agent's `model` override).
 *
 * Rules:
 * - Must be a non-empty string (after trimming).
 * - Must not contain internal whitespace (model identifiers are single tokens).
 * - Must not exceed {@link MAX_MODEL_STRING_LENGTH} characters.
 *
 * `label` is interpolated into the error message so callers can identify the
 * source — pass `'AI_MODEL'` for the env var, or `agent "<name>" model` for an
 * agent override.
 */
export const validateModelString = (label: string, value: string): ModelStringValidation => {
  if (value === '') {
    return { ok: false, message: `${label} must be a non-empty string.` }
  }
  if (/\s/.test(value)) {
    return {
      ok: false,
      message: `${label} has an invalid format: model identifiers must not contain whitespace (got "${value}").`,
    }
  }
  if (value.length > MAX_MODEL_STRING_LENGTH) {
    return {
      ok: false,
      message: `${label} exceeds the maximum length of ${MAX_MODEL_STRING_LENGTH} characters (got ${value.length}).`,
    }
  }
  return { ok: true }
}
