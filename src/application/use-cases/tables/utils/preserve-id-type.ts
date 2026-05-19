/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export function preserveIdType(raw: unknown): string | number {
  if (typeof raw === 'number') return raw
  const asString = String(raw)
  const numeric = Number(asString)
  return Number.isFinite(numeric) && asString === String(numeric) ? numeric : asString
}
