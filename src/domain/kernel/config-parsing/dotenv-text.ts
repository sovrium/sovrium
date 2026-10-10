/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A strict reader of a variables file (`NAME=value` per line), for the CLI
 * commands that send a hosted app its variables.
 *
 * Strict on purpose: the value is everything after the first `=`, byte for
 * byte — no quote is stripped, no blank trimmed, no `$` expanded — so a value
 * that would reach the app altered can be refused by name instead of being
 * silently rewritten. A blank line or a line whose first non-blank character
 * is `#` is skipped; any other line that is not `NAME=value` is reported by
 * its number, never by its content, which may hold a secret.
 */

/** One variable read from the file, with the line it came from (counted from 1). */
export interface DotenvEntry {
  readonly name: string
  readonly value: string
  readonly line: number
}

/** What the file holds: its variables in file order, and every line it could not read. */
export interface DotenvText {
  readonly entries: readonly DotenvEntry[]
  readonly problems: readonly string[]
}

const ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s

/** Split into lines, dropping the `\r` of a file written on Windows. */
const linesOf = (text: string): readonly string[] =>
  text.split('\n').map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line))

const isSkipped = (line: string): boolean => {
  const start = line.trimStart()
  return start === '' || start.startsWith('#')
}

/**
 * Read a variables file. A name set twice is a problem rather than a choice
 * between the two values.
 */
export const parseDotenvText = (text: string): DotenvText =>
  linesOf(text).reduce<DotenvText>(
    (read, line, index) => {
      if (isSkipped(line)) return read
      const number = index + 1
      const match = ASSIGNMENT.exec(line)
      if (match === null) {
        return {
          ...read,
          problems: [...read.problems, `line ${number} is not NAME=value`],
        }
      }
      const name = match[1] ?? ''
      const earlier = read.entries.find((entry) => entry.name === name)
      if (earlier !== undefined) {
        return {
          ...read,
          problems: [
            ...read.problems,
            `${name} is set twice (lines ${earlier.line} and ${number})`,
          ],
        }
      }
      return { ...read, entries: [...read.entries, { name, value: match[2] ?? '', line: number }] }
    },
    { entries: [], problems: [] }
  )
