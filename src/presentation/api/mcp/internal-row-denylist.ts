/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { InternalTableEntry } from '@/domain/models/app/tables/internal-tables'

/**
 * Strip every column listed in the registry's `denylistFields` from a single
 * row, then return the cleaned row.
 *
 * Each denylist value is matched in BOTH camelCase (the Drizzle TypeScript
 * field name) AND snake_case (the underlying PostgreSQL column name). The
 * `bun:sql` driver returns rows keyed by snake_case, but a future migration
 * to a driver that auto-camelizes (e.g. drizzle's `casing: 'camelCase'`
 * setting) would silently re-expose the secrets — stripping both spellings
 * keeps the denylist forward-compatible.
 *
 * Implemented as an immutable map / filter (no in-place delete) per the
 * project-wide functional/immutable-data ESLint rule.
 */
export const stripDenylistedColumns = (
  row: Readonly<Record<string, unknown>>,
  entry: InternalTableEntry
): Readonly<Record<string, unknown>> => {
  if (entry.denylistFields.length === 0) return { ...row }
  // Build the denial set immutably — each denylist field expands to BOTH
  // the camelCase TS spelling AND its snake_case equivalent so the strip
  // catches whichever the driver returns. flatMap + Set constructor keeps
  // us within the project-wide functional/immutable-data rule.
  const denied = new Set<string>(
    entry.denylistFields.flatMap((field) => [field, camelToSnake(field)])
  )
  return Object.fromEntries(Object.entries(row).filter(([key]) => !denied.has(key)))
}

const camelToSnake = (s: string): string => s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
