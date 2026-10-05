/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** A quoted string or identifier, `''` / `""` escapes included. */
const QUOTED = /'(?:[^']|'')*'|"(?:[^"]|"")*"/g

/** A quoted run, or a whitespace run between two of them. */
const QUOTED_OR_SPACE = /'(?:[^']|'')*'|"(?:[^"]|"")*"|\s+/g

/**
 * Blank every quoted run while keeping its length, so offsets found in the
 * masked text address the same characters in the original — and a `(`, `)` or
 * `CHECK` inside an option value or a quoted identifier is never read as SQL.
 */
const maskQuoted = (ddl: string): string => ddl.replace(QUOTED, (run) => '_'.repeat(run.length))

/** Collapse whitespace outside quoted runs: two DDL texts differing only in layout compare equal. */
const collapseWhitespace = (clause: string): string =>
  clause.replace(QUOTED_OR_SPACE, (run) => (/^\s/.test(run) ? ' ' : run)).trim()

/** Offset of the `)` closing the `(` at `open`, or `undefined` when it is never closed. */
const closingParenthesis = (masked: string, open: number): number | undefined =>
  Array.from(masked.slice(open)).reduce<{ readonly depth: number; readonly end?: number }>(
    (state, character, offset) => {
      if (state.end !== undefined) return state
      if (character === '(') return { depth: state.depth + 1 }
      if (character !== ')') return state
      return state.depth === 1 ? { depth: 0, end: open + offset } : { depth: state.depth - 1 }
    },
    { depth: 0 }
  ).end

/**
 * Every `CHECK (…)` clause of a DDL text, whitespace-collapsed, WITHOUT the
 * constraint name in front of it.
 *
 * The name is left out on purpose: a SQLite rebuild keeps the temp-scoped name
 * it created the table under, and renaming a column never renames a
 * constraint, so two tables enforcing the same rule can carry different names.
 * What the database enforces is the clause.
 */
export const extractCheckClauses = (ddl: string): readonly string[] => {
  const masked = maskQuoted(ddl)
  return Array.from(masked.matchAll(/\bCHECK\s*\(/gi)).flatMap((match) => {
    const open = match.index + match[0].length - 1
    const close = closingParenthesis(masked, open)
    return close === undefined ? [] : [collapseWhitespace(`CHECK ${ddl.slice(open, close + 1)}`)]
  })
}

/**
 * How the CHECK clauses of a live table differ from the ones its definition
 * declares: `missing` are declared but not in force (an option added to a
 * single-select whose table was never rebuilt), `unexpected` are in force but
 * no longer declared (the option list they replaced). Both empty when the
 * table enforces exactly what it declares.
 */
export const diffCheckClauses = (
  liveDdl: string,
  expectedDdl: string
): { readonly missing: readonly string[]; readonly unexpected: readonly string[] } => {
  const live = extractCheckClauses(liveDdl)
  const expected = extractCheckClauses(expectedDdl)
  const liveSet = new Set(live)
  const expectedSet = new Set(expected)
  return {
    missing: expected.filter((clause) => !liveSet.has(clause)),
    unexpected: live.filter((clause) => !expectedSet.has(clause)),
  }
}
