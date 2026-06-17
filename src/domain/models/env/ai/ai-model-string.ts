/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const MAX_MODEL_STRING_LENGTH = 128

export type ModelStringValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string }

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
