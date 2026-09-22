/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Preserve the source-of-truth id type. SERIAL ids stay numeric; TEXT
 * primary keys (used by scope tables and any application that opts in)
 * stay as strings. Coerces only when the underlying value is unambiguously
 * numeric (e.g. a numeric BIGSERIAL value returned by `bun:sql` as a
 * string-shaped number).
 *
 * Avoids `Number(record.id)` returning NaN for opaque string ids like
 * `'t1'`, which previously broke the `getRecordResponseSchema` Zod
 * decoder downstream.
 */
export function preserveIdType(raw: unknown): string | number {
  if (typeof raw === 'number') return raw
  const asString = String(raw)
  const numeric = Number(asString)
  return Number.isFinite(numeric) && asString === String(numeric) ? numeric : asString
}
