/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Recover a JSON-valued column that SQLite hands back as TEXT.
 *
 * PostgreSQL has `JSONB` and `TEXT[]`; SQLite has neither, so every column
 * Sovrium declares as one of those is created as `TEXT` holding a serialized
 * document (`sql-type-mappings.ts` → `mapPostgresTypeToSqlite`). The Postgres
 * driver deserializes such a column for free; the SQLite driver returns the
 * string exactly as written.
 *
 * Any read path that inspects the SHAPE of such a value must therefore parse
 * first, or it silently mis-reads the serialized document as a scalar. That has
 * already happened twice with attachment columns — once where the whole JSON
 * blob became the storage key inside a signed URL, and once where it became the
 * key handed to `storage.delete()`, so purging a record left its file orphaned
 * on the DEFAULT engine while Postgres looked fine.
 *
 * These helpers exist so those paths share ONE parser instead of each carrying a
 * private copy that can drift apart again.
 */

/**
 * Parse a cell that should hold a JSON OBJECT.
 *
 * Returns `undefined` — never throws, never guesses — when the value is not a
 * string, does not open with `{`, is not valid JSON, or parses to something
 * that is not a plain object. Callers are expected to fall back to the original
 * value, so a genuine storage key that merely begins with a brace survives
 * untouched.
 */
export const parseJsonObjectCell = (
  value: unknown
): Readonly<Record<string, unknown>> | undefined => {
  if (typeof value !== 'string' || !value.startsWith('{')) return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Readonly<Record<string, unknown>>)
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Parse a cell that should hold a JSON ARRAY.
 *
 * Same contract as {@link parseJsonObjectCell}: `undefined` rather than a throw
 * or a guess, so the caller can fall back to the raw value.
 */
export const parseJsonArrayCell = (value: unknown): readonly unknown[] | undefined => {
  if (typeof value !== 'string' || !value.startsWith('[')) return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}
