/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which tables a config change would newly authorise to drop data.
 *
 * `allowDestructive: true` is the operator's standing consent for one table:
 * with it set, the migration engine drops a column whose field disappeared
 * instead of refusing. Setting it is therefore a decision about the rows behind
 * the config, and nothing in `AppSchema` knows anything about those rows — a
 * document that turns it on decodes exactly as cleanly as one that does not.
 *
 * ### Why INTRODUCED rather than merely present
 *
 * A config that has carried the flag for months is the operator's own settled
 * choice, and re-asking about it on every unrelated edit teaches its reader to
 * wave the question through — which is the failure mode a confirmation exists to
 * prevent. What needs consent is the MOMENT the answer changes.
 *
 * ### Why this is asked of the RAW config
 *
 * `applySchemaDefaults` may fill the flag in for a decoded table, so the decoded
 * view cannot tell a default apart from something the author wrote. The question
 * is only answerable of the two documents as they are written.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Every `tables[]` entry of a parsed config, or an empty list. */
const tablesOf = (parsed: unknown): ReadonlyArray<Record<string, unknown>> => {
  if (!isRecord(parsed)) return []
  const { tables } = parsed
  return Array.isArray(tables) ? tables.filter((table) => isRecord(table)) : []
}

const tableName = (table: Readonly<Record<string, unknown>>): string =>
  typeof table.name === 'string' ? table.name : ''

const allowsDestructive = (table: Readonly<Record<string, unknown>>): boolean =>
  table.allowDestructive === true

/**
 * Tables the candidate would newly mark `allowDestructive: true`.
 *
 * A table the candidate INTRODUCES with the flag already set counts: nobody has
 * consented to it either, and a new table carrying it is the same decision made
 * in one step rather than two.
 *
 * Both arguments are the `$ref`-RESOLVED configs as PARSED — see the header.
 *
 * @param currentParsed - The config as it stands on disk
 * @param candidateParsed - The config the write would leave behind
 * @returns The names of the newly-destructive tables, in candidate order
 * @public
 */
export const findIntroducedDestructiveTables = (
  currentParsed: unknown,
  candidateParsed: unknown
): readonly string[] => {
  const before = new Set(
    tablesOf(currentParsed)
      .filter((table) => allowsDestructive(table))
      .map((table) => tableName(table))
  )

  return tablesOf(candidateParsed)
    .filter((table) => allowsDestructive(table) && !before.has(tableName(table)))
    .map((table) => tableName(table))
}
