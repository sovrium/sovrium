/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

export function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      yield* walk(full)
    } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      yield full
    }
  }
}

export interface CommentRange {
  readonly pos: number
  readonly end: number
}

export function collectComments(sourceFile: ts.SourceFile, text: string): readonly CommentRange[] {
  const ranges = new Map<number, CommentRange>()
  const visit = (node: ts.Node): void => {
    for (const r of ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []) {
      ranges.set(r.pos, { pos: r.pos, end: r.end })
    }
    for (const r of ts.getTrailingCommentRanges(text, node.getEnd()) ?? []) {
      ranges.set(r.pos, { pos: r.pos, end: r.end })
    }
    node.getChildren(sourceFile).forEach(visit)
  }
  visit(sourceFile)
  return [...ranges.values()].sort((a, b) => a.pos - b.pos)
}

export function shouldPreserveComment(commentText: string): boolean {
  if (commentText.includes('Business Source License')) {
    return true
  }

  if (/^\/\/\/\s*</.test(commentText)) {
    return true
  }

  const inner = commentText.replace(/^[/*]+/, '').trimStart()
  if (/^@ts-(expect-error|ignore|nocheck|check)\b/.test(inner)) {
    return true
  }

  return false
}

function expandRemoval(text: string, pos: number, end: number): CommentRange {
  let lineStart = pos
  while (lineStart > 0 && text[lineStart - 1] !== '\n') {
    lineStart -= 1
  }

  if (text.slice(lineStart, pos).trim() === '') {
    let lineEnd = end
    if (text[lineEnd] === '\r') lineEnd += 1
    if (text[lineEnd] === '\n') lineEnd += 1
    return { pos: lineStart, end: lineEnd }
  }

  let start = pos
  while (start > 0 && (text[start - 1] === ' ' || text[start - 1] === '\t')) {
    start -= 1
  }
  return { pos: start, end }
}

export function scrubFile(path: string): void {
  const text = readFileSync(path, 'utf8')
  const sourceFile = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)

  const removals: CommentRange[] = []
  for (const { pos, end } of collectComments(sourceFile, text)) {
    if (!shouldPreserveComment(text.slice(pos, end))) {
      removals.push(expandRemoval(text, pos, end))
    }
  }
  if (removals.length === 0) {
    return
  }
  removals.sort((a, b) => a.pos - b.pos)

  let result = ''
  let cursor = 0
  for (const { pos, end } of removals) {
    if (pos > cursor) {
      result += text.slice(cursor, pos)
    }
    cursor = Math.max(cursor, end)
  }
  result += text.slice(cursor)

  if (result !== text) {
    writeFileSync(path, result)
  }
}

function main(): void {
  const dirs = process.argv.slice(2)
  if (dirs.length === 0) {
    console.error('Usage: bun run scripts/scrub-mirror-comments.ts <dir> [<dir>...]')
    process.exit(1)
  }

  let scrubbed = 0
  for (const dir of dirs) {
    for (const file of walk(dir)) {
      scrubFile(file)
      scrubbed += 1
    }
  }
  console.log(`scrub-mirror-comments: processed ${scrubbed} files in ${dirs.join(', ')}`)
}

if (import.meta.main) {
  main()
}
