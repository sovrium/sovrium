/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** The index just past a quoted run starting at `index` (`'it''s'`, `"order"`). */
const skipQuoted = (sql: string, index: number): number => {
  const quote = sql[index]
  let cursor = index + 1
  while (cursor < sql.length) {
    if (sql[cursor] === quote && sql[cursor + 1] === quote) cursor += 2
    else if (sql[cursor] === quote) return cursor + 1
    else cursor += 1
  }
  return cursor
}

/** The top-level arguments of the call whose `(` is at `open`, and the index past its `)`. */
export const readArguments = (
  sql: string,
  open: number
): { readonly args: readonly string[]; readonly end: number } => {
  let depth = 0
  let cursor = open + 1
  let argStart = cursor
  let args: readonly string[] = []
  while (cursor < sql.length) {
    const char = sql[cursor]
    if (char === "'" || char === '"') {
      cursor = skipQuoted(sql, cursor)
      continue
    }
    if (char === '(') depth += 1
    else if (char === ')' && depth === 0) {
      return { args: [...args, sql.slice(argStart, cursor).trim()], end: cursor + 1 }
    } else if (char === ')') depth -= 1
    else if (char === ',' && depth === 0) {
      args = [...args, sql.slice(argStart, cursor).trim()]
      argStart = cursor + 1
    }
    cursor += 1
  }
  return { args: [...args, sql.slice(argStart).trim()], end: sql.length }
}

/** One function call of a formula: its name, where it starts and ends, its arguments as written. */
export interface CallToken {
  readonly name: string
  readonly start: number
  readonly end: number
  readonly args: readonly string[]
}

/**
 * The first call token `pattern` matches in `sql` — `pattern` anchored at the
 * start (`/^(if)\s*\(/i`), its first group the function name. A call inside a
 * string literal or a quoted name is skipped, and so is a name that is the tail
 * of a longer or qualified one (`motif(`, `t.if(`): only a name not preceded by
 * a word character or a dot is a call.
 */
export const findCallToken = (sql: string, pattern: RegExp): CallToken | undefined => {
  let cursor = 0
  while (cursor < sql.length) {
    const char = sql[cursor] ?? ''
    if (char === "'" || char === '"') {
      cursor = skipQuoted(sql, cursor)
      continue
    }
    const previous = sql[cursor - 1] ?? ''
    const match = /[\w.]/.test(previous) ? null : pattern.exec(sql.slice(cursor))
    if (match !== null) {
      const { args, end } = readArguments(sql, cursor + match[0].length - 1)
      return { name: (match[1] ?? '').toLowerCase(), start: cursor, end, args }
    }
    cursor += 1
  }
  return undefined
}
