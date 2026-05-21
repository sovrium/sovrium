/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface ParsedTsv {
  readonly headers: readonly string[]
  readonly rows: readonly (readonly string[])[]
}

function splitLine(line: string): readonly string[] {
  return line.split('\t')
}

export function parseTsv(content: string): ParsedTsv {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)

  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = splitLine(lines[0]!).map((cell) => cell.trim())
  const width = headers.length

  const rows = lines.slice(1).map((line) => {
    const cells = splitLine(line).map((cell) => cell.trim())
    return Array.from({ length: width }, (_, i) => cells[i] ?? '')
  })

  return { headers, rows }
}
