/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Generate SHA256 checksums for release artifacts.
 *
 * Scans a directory for files matching one or more explicit glob patterns and
 * writes a `shasum -a 256` -compatible file: one `<hash>  <name>` line per
 * artifact, sorted by name.
 *
 * ## Why patterns are a parameter
 *
 * This used to hard-code `sovrium-*.tar.gz` — the shape of every release asset
 * that existed when it was written. The desktop shell adds five more per
 * release (`.dmg`, `.exe`, `.AppImage`, `.deb`, `.zip`), and a hard-coded
 * pattern does not fail on those: it matches none of them and reports a
 * checksum file that is silently missing half the release. Extending the
 * literal would have moved the problem to the next asset type rather than
 * removing it.
 *
 * So the caller says what it expects. The default stays `sovrium-*.tar.gz`, so
 * every existing invocation is unchanged.
 *
 * ## Zero matches is a FAILURE
 *
 * The one behaviour that must not be relaxed. A checksum generator that finds
 * nothing and exits 0 writes an empty file that downstream verification treats
 * as "nothing to verify" — the release publishes, and the assets it claims to
 * have hashed were never hashed. A glob that matches nothing means the caller's
 * expectation and the directory disagree, and that is a fact worth stopping on.
 * Every pattern is reported individually for the same reason: a run that
 * matched three of four patterns must say WHICH one was empty.
 *
 * Usage:
 *   bun run scripts/build/generate-checksums.ts
 *   bun run scripts/build/generate-checksums.ts --dir ./release
 *   bun run scripts/build/generate-checksums.ts --output checksums.txt
 *   bun run scripts/build/generate-checksums.ts --pattern 'Sovrium-*.dmg' --pattern '*.AppImage'
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { listDirSync } from '../lib/drift/walk'

/** What this matched when nobody said otherwise: the binary tarballs. */
export const DEFAULT_PATTERNS: readonly string[] = ['sovrium-*.tar.gz']

/** One pattern and the file names it matched, in name order. */
export interface PatternMatch {
  readonly pattern: string
  readonly files: readonly string[]
}

/**
 * Match `names` against each pattern, keeping the patterns separate.
 *
 * Separate rather than unioned because the failure message has to name the
 * pattern that came back empty: "no match for `Sovrium-*.dmg`" is actionable,
 * "no matches" after four patterns is not. A file matching two patterns appears
 * once in the final list — {@link checksumTargets} de-duplicates.
 */
export const matchPatterns = (
  names: readonly string[],
  patterns: readonly string[]
): readonly PatternMatch[] =>
  patterns.map((pattern) => {
    const glob = new Bun.Glob(pattern)
    return { pattern, files: names.filter((name) => glob.match(name)).sort() }
  })

/** Every matched name, de-duplicated and sorted. */
export const checksumTargets = (matches: readonly PatternMatch[]): readonly string[] =>
  [...new Set(matches.flatMap((match) => match.files))].sort()

/** Patterns that matched nothing — each one a reason to refuse. */
export const emptyPatterns = (matches: readonly PatternMatch[]): readonly string[] =>
  matches.filter((match) => match.files.length === 0).map((match) => match.pattern)

/** Hash one file and render its `shasum -a 256` line. */
export const checksumLine = (dir: string, file: string): string => {
  const content = readFileSync(join(dir, file))
  const hash = new Bun.CryptoHasher('sha256').update(content).digest('hex')
  return `${hash}  ${file}`
}

/** Collect every `--<flag> <value>` occurrence, in order. */
export const repeatedFlag = (args: readonly string[], flag: string): readonly string[] => {
  const values: string[] = []
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] !== flag) continue
    const value = args[i + 1]
    if (value !== undefined) values.push(value)
  }
  return values
}

const main = (args: readonly string[]): number => {
  const dirIdx = args.indexOf('--dir')
  const dirArg = dirIdx !== -1 ? args[dirIdx + 1] : undefined
  const dir = dirArg ?? process.cwd()

  const outputIdx = args.indexOf('--output')
  const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : undefined

  const requested = repeatedFlag(args, '--pattern')
  const patterns = requested.length > 0 ? requested : DEFAULT_PATTERNS

  // `listDirSync` rather than a bare `readdirSync`: a missing or mistyped
  // release directory must be a loud failure here, not an empty file list that
  // reads as "nothing to checksum".
  const names = listDirSync({ root: dir }).map((abs) => basename(abs))
  const matches = matchPatterns(names, patterns)

  const empty = emptyPatterns(matches)
  if (empty.length > 0) {
    printStderr(
      `No file in ${dir} matches ${empty.length} of ${patterns.length} requested pattern(s) — ` +
        'no checksum was written.\n' +
        empty.map((pattern) => `  [no match] ${pattern}`).join('\n')
    )
    return 1
  }

  const files = checksumTargets(matches)
  const output = files.map((file) => checksumLine(dir, file)).join('\n') + '\n'

  if (outputFile) {
    writeFileSync(join(dir, outputFile), output)
    console.log(`Checksums written to ${outputFile}`)
  } else {
    process.stdout.write(output)
  }

  printStderr(
    `Generated checksums for ${files.length} file(s) across ${patterns.length} pattern(s)`
  )
  return 0
}

if (import.meta.main) {
  process.exit(main(Bun.argv.slice(2)))
}
