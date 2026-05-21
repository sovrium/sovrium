/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PROJECT_ROOT = resolve(import.meta.dir, '..')
const DRY_RUN = process.argv.includes('--dry-run')

interface KnipJsonReport {
  readonly issues: ReadonlyArray<KnipFileIssues>
}

interface KnipFileIssues {
  readonly file: string
  readonly exports?: ReadonlyArray<KnipNamedItem>
  readonly types?: ReadonlyArray<KnipNamedItem>
}

interface KnipNamedItem {
  readonly name: string
  readonly line?: number
  readonly col?: number
  readonly symbol?: string
}

const runKnip = (): KnipJsonReport => {
  const result = spawnSync('bunx', ['knip', '--reporter', 'json'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
  })
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`knip failed (exit ${result.status}): ${result.stderr}`)
  }
  return JSON.parse(result.stdout) as KnipJsonReport
}

interface OrphanRef {
  readonly file: string
  readonly name: string
}

const collectOrphans = (report: KnipJsonReport): readonly OrphanRef[] => {
  const orphans: OrphanRef[] = []
  for (const fileIssue of report.issues) {
    for (const item of fileIssue.exports ?? []) {
      if (item.name === 'default') continue
      orphans.push({ file: fileIssue.file, name: item.name })
    }
    for (const item of fileIssue.types ?? []) {
      orphans.push({ file: fileIssue.file, name: item.name })
    }
  }
  return orphans
}

interface TagResult {
  readonly file: string
  readonly tagged: number
  readonly skipped: number
  readonly notFound: readonly string[]
}

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const findExportLine = (lines: readonly string[], name: string): number => {
  const escaped = escapeRegex(name)
  const patterns = [
    new RegExp(
      `^\\s*export\\s+(?:async\\s+)?(?:const|let|var|function\\*?|type|interface|class|enum|abstract\\s+class)\\s+${escaped}\\b`
    ),
    new RegExp(`^\\s*export\\s+default\\s+(?:async\\s+)?(?:function\\*?|class)\\s+${escaped}\\b`),
    new RegExp(`^\\s*export\\s+(?:type\\s+)?\\{[^}]*\\b${escaped}\\b`),
  ]
  for (let i = 0; i < lines.length; i++) {
    for (const pat of patterns) {
      if (pat.test(lines[i] ?? '')) return i
    }
  }
  return -1
}

const isStickyDirective = (line: string): boolean =>
  /^\s*\/\/\s*(eslint-disable-next-line|@ts-expect-error|@ts-ignore|@ts-nocheck|biome-ignore)\b/.test(
    line
  )

const isAlreadyTagged = (lines: readonly string[], exportLine: number): boolean => {
  for (let i = exportLine - 1; i >= 0; i--) {
    const line = lines[i] ?? ''
    if (/@public\b/.test(line)) return true
    if (/\/\*\*/.test(line)) return false
    if (/^\s*\*/.test(line) || line.trim() === '' || isStickyDirective(line)) continue
    return false
  }
  return false
}

const findExistingJSDocOpenLine = (lines: readonly string[], exportLine: number): number => {
  let i = exportLine - 1
  if (i < 0) return -1
  if (!/^\s*\*\//.test(lines[i] ?? '')) return -1
  while (i >= 0) {
    const line = lines[i] ?? ''
    if (/^\s*\/\*\*/.test(line)) return i
    i--
  }
  return -1
}

const insertPublicTag = (lines: string[], exportLine: number): boolean => {
  let insertAt = exportLine
  while (insertAt > 0 && isStickyDirective(lines[insertAt - 1] ?? '')) {
    insertAt--
  }

  const jsdocOpen = findExistingJSDocOpenLine(lines, insertAt)
  if (jsdocOpen >= 0) {
    for (let i = insertAt - 1; i >= jsdocOpen; i--) {
      const line = lines[i] ?? ''
      const closeMatch = /^(\s*)\*\//.exec(line)
      if (closeMatch !== null) {
        const indent = closeMatch[1] ?? ''
        lines.splice(i, 0, `${indent} * @public`)
        return true
      }
    }
    return false
  }
  const exportLineText = lines[exportLine] ?? ''
  const indentMatch = /^(\s*)/.exec(exportLineText)
  const indent = indentMatch?.[1] ?? ''
  lines.splice(insertAt, 0, `${indent}/** @public */`)
  return true
}

const tagFile = (filePath: string, names: readonly string[]): TagResult => {
  const absPath = resolve(PROJECT_ROOT, filePath)
  const original = readFileSync(absPath, 'utf-8')
  const trailingNewline = original.endsWith('\n')
  const lines = original.split('\n')

  let tagged = 0
  let skipped = 0
  const notFound: string[] = []

  const locations: Array<{ name: string; line: number }> = []
  for (const name of names) {
    const idx = findExportLine(lines, name)
    if (idx < 0) {
      notFound.push(name)
      continue
    }
    locations.push({ name, line: idx })
  }
  locations.sort((a, b) => b.line - a.line)

  for (const loc of locations) {
    if (isAlreadyTagged(lines, loc.line)) {
      skipped++
      continue
    }
    if (insertPublicTag(lines, loc.line)) {
      tagged++
    } else {
      notFound.push(loc.name)
    }
  }

  if (tagged > 0 && !DRY_RUN) {
    const out = lines.join('\n') + (trailingNewline && !lines.join('\n').endsWith('\n') ? '' : '')
    let final = lines.join('\n')
    if (trailingNewline && !final.endsWith('\n')) final += '\n'
    writeFileSync(absPath, final, 'utf-8')
    void out
  }

  return { file: filePath, tagged, skipped, notFound }
}

const main = (): void => {
  process.stdout.write('Running knip to collect orphans...\n')
  const report = runKnip()
  const orphans = collectOrphans(report)
  process.stdout.write(
    `Found ${orphans.length} orphan exports/types across ${report.issues.length} files.\n`
  )

  const byFile = new Map<string, string[]>()
  for (const o of orphans) {
    if (!byFile.has(o.file)) byFile.set(o.file, [])
    byFile.get(o.file)?.push(o.name)
  }

  let totalTagged = 0
  let totalSkipped = 0
  const allNotFound: Array<{ file: string; name: string }> = []

  for (const [file, names] of byFile) {
    const result = tagFile(file, names)
    totalTagged += result.tagged
    totalSkipped += result.skipped
    for (const n of result.notFound) {
      allNotFound.push({ file: result.file, name: n })
    }
    if (result.tagged > 0 || result.notFound.length > 0) {
      process.stdout.write(
        `  ${file}: tagged=${result.tagged}, skipped=${result.skipped}, notFound=${result.notFound.length}\n`
      )
    }
  }

  process.stdout.write(
    `\n${DRY_RUN ? '[dry-run] ' : ''}Tagged: ${totalTagged}, Skipped (already tagged): ${totalSkipped}, Not found: ${allNotFound.length}\n`
  )
  if (allNotFound.length > 0) {
    process.stdout.write('\nUnable to locate the following exports — tag manually:\n')
    for (const { file, name } of allNotFound) {
      process.stdout.write(`  ${file}: ${name}\n`)
    }
  }
}

main()
