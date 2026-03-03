#!/usr/bin/env bun
/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Analyze Commits — Conventional commit analysis for automated releases
 *
 * Parses git log since the last tag, classifies commits by type,
 * determines the version bump level, and generates a changelog.
 *
 * Usage:
 *   bun run scripts/analyze-commits.ts              # JSON output to stdout
 *   bun run scripts/analyze-commits.ts --dry-run    # Human-readable output
 *   bun run scripts/analyze-commits.ts --from v0.0.1  # Override start tag
 *
 * Output (JSON):
 *   { bump, currentVersion, newVersion, changelog, commitCount }
 */

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── Types ────────────────────────────────────────────────────────

export type BumpLevel = 'major' | 'minor' | 'patch'

export interface ParsedCommit {
  readonly hash: string
  readonly type: string
  readonly scope: string | null
  readonly description: string
  readonly breaking: boolean
  readonly body: string
}

export interface AnalysisResult {
  readonly bump: BumpLevel | null
  readonly currentVersion: string
  readonly newVersion: string | null
  readonly changelog: string
  readonly commitCount: number
}

// ─── Constants ────────────────────────────────────────────────────

const REPO_URL = 'https://github.com/sovrium/sovrium'

/**
 * Commit types that trigger a release bump.
 * Maps type → { bump level, changelog section heading }
 */
const RELEASABLE_TYPES: ReadonlyMap<
  string,
  { readonly bump: BumpLevel; readonly heading: string }
> = new Map([
  ['feat', { bump: 'minor', heading: 'Features' }],
  ['fix', { bump: 'patch', heading: 'Bug Fixes' }],
  ['perf', { bump: 'patch', heading: 'Performance Improvements' }],
])

/**
 * Commit types that appear in the changelog only when mixed with releasable commits.
 */
const CHANGELOG_ONLY_TYPES: ReadonlyMap<string, string> = new Map([
  ['refactor', 'Refactoring'],
  ['docs', 'Documentation'],
  ['style', 'Styles'],
  ['test', 'Tests'],
  ['chore', 'Chores'],
  ['ci', 'CI'],
  ['build', 'Build'],
])

/**
 * Patterns that cause a commit to be filtered out entirely (no changelog, no bump).
 */
const SKIP_PATTERNS: readonly RegExp[] = [
  /^Merge /,
  /\[skip ci\]/i,
  /^release:/,
  /^\[TDD\]/,
  /^chore\(release\):/,
  /^Bump \S+ from \S+ to \S+/,
]

// ─── Pure Functions (exported for testing) ────────────────────────

/**
 * Parse a single raw commit line (hash + subject + body delimiter) into a structured commit.
 *
 * Expected format from git log:
 *   <hash> <subject>\n<body>
 */
export function parseCommit(raw: string): ParsedCommit | null {
  // Split into first line (hash + subject) and rest (body)
  const [firstLine, ...bodyLines] = raw.split('\n')
  if (!firstLine) return null

  const subject = firstLine.trim()
  const body = bodyLines.join('\n').trim()

  // Extract hash (first 7+ chars before space)
  const spaceIdx = subject.indexOf(' ')
  if (spaceIdx === -1) return null

  const hash = subject.slice(0, spaceIdx)
  const message = subject.slice(spaceIdx + 1)

  // Should any skip pattern match the message, filter the commit out entirely
  if (SKIP_PATTERNS.some((p) => p.test(message))) return null

  // Parse conventional commit: type(scope)!: description
  const conventionalMatch = message.match(/^(\w+)(?:\(([^)]*)\))?(!)?\s*:\s*(.+)$/)
  if (!conventionalMatch) {
    // Not a conventional commit — treat as unknown type, no bump
    return null
  }

  const [, type, scope, bang, description] = conventionalMatch

  // Breaking change: either ! after type/scope, or BREAKING CHANGE: in body
  const breaking = !!bang || /^BREAKING[ -]CHANGE\s*:/m.test(body)

  return {
    hash,
    type: type!.toLowerCase(),
    scope: scope ?? null,
    description: description!.trim(),
    breaking,
    body,
  }
}

/**
 * Determine the highest bump level from a list of parsed commits.
 * Returns null if no releasable commits found.
 */
export function determineBump(commits: readonly ParsedCommit[]): BumpLevel | null {
  let highest: BumpLevel | null = null

  for (const commit of commits) {
    if (commit.breaking) return 'major' // Short-circuit: can't go higher

    const typeInfo = RELEASABLE_TYPES.get(commit.type)
    if (!typeInfo) continue

    if (highest === null || typeInfo.bump === 'minor') {
      highest = typeInfo.bump
    }
  }

  return highest
}

/**
 * Bump a semver version string by the given level.
 */
export function bumpVersion(current: string, level: BumpLevel): string {
  const [major, minor, patch] = current.split('.').map(Number) as [number, number, number]

  switch (level) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
  }
}

/**
 * Generate a markdown changelog from parsed commits.
 */
export function generateChangelog(
  commits: readonly ParsedCommit[],
  version: string,
  previousVersion: string,
  date: string
): string {
  const lines: string[] = []

  // Header with comparison link
  lines.push(`## [${version}](${REPO_URL}/compare/v${previousVersion}...v${version}) (${date})`, '')

  // Group breaking changes first
  const breakingCommits = commits.filter((c) => c.breaking)
  if (breakingCommits.length > 0) {
    lines.push('### BREAKING CHANGES', '')
    for (const c of breakingCommits) {
      lines.push(formatCommitLine(c))
    }
    lines.push('')
  }

  // Group by type: releasable first, then changelog-only
  const allTypes = new Map([...RELEASABLE_TYPES, ...mapToTypeInfo(CHANGELOG_ONLY_TYPES)])

  for (const [type, info] of allTypes) {
    const typeCommits = commits.filter((c) => c.type === type && !c.breaking)
    if (typeCommits.length === 0) continue

    lines.push(`### ${info.heading}`, '')
    for (const c of typeCommits) {
      lines.push(formatCommitLine(c))
    }
    lines.push('')
  }

  return lines.join('\n').trim() + '\n'
}

function formatCommitLine(c: ParsedCommit): string {
  const scopePart = c.scope ? `**${c.scope}**: ` : ''
  return `- ${scopePart}${c.description} ([${c.hash}](${REPO_URL}/commit/${c.hash}))`
}

function mapToTypeInfo(
  m: ReadonlyMap<string, string>
): Map<string, { readonly bump: BumpLevel; readonly heading: string }> {
  const result = new Map<string, { readonly bump: BumpLevel; readonly heading: string }>()
  for (const [type, heading] of m) {
    // These don't actually trigger a bump — the bump field is unused for changelog-only types
    result.set(type, { bump: 'patch', heading })
  }
  return result
}

// ─── Git Integration ──────────────────────────────────────────────

export interface GitAdapter {
  readonly getLatestTag: () => string | null
  readonly getLog: (from: string | null) => string
  readonly getCurrentVersion: () => string
}

const run = (cmd: string): string => execSync(cmd, { encoding: 'utf-8' }).trim()

function createRealGitAdapter(): GitAdapter {
  return {
    getLatestTag: () => {
      try {
        return run('git describe --tags --abbrev=0')
      } catch {
        return null
      }
    },
    getLog: (from: string | null) => {
      // Use %x00 as commit delimiter, %B for full body
      const range = from ? `${from}..HEAD` : 'HEAD'
      try {
        return run(`git log ${range} --format="%h %s%n%b%x00"`)
      } catch {
        return ''
      }
    },
    getCurrentVersion: () => {
      const pkgPath = join(process.cwd(), 'package.json')
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string }
      return pkg.version
    },
  }
}

// ─── Main Analysis ────────────────────────────────────────────────

export function analyzeCommits(rawLog: string): readonly ParsedCommit[] {
  if (!rawLog.trim()) return []

  return rawLog
    .split('\0')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map(parseCommit)
    .filter((c): c is ParsedCommit => c !== null)
}

export function analyze(git: GitAdapter, fromTag?: string): AnalysisResult {
  const currentVersion = git.getCurrentVersion()
  const latestTag = fromTag ?? git.getLatestTag()
  const rawLog = git.getLog(latestTag)
  const commits = analyzeCommits(rawLog)
  const bump = determineBump(commits)

  if (!bump) {
    return {
      bump: null,
      currentVersion,
      newVersion: null,
      changelog: '',
      commitCount: commits.length,
    }
  }

  const newVersion = bumpVersion(currentVersion, bump)
  const today = new Date().toISOString().split('T')[0]!
  const changelog = generateChangelog(commits, newVersion, currentVersion, today)

  return {
    bump,
    currentVersion,
    newVersion,
    changelog,
    commitCount: commits.length,
  }
}

// ─── CLI Entry Point ──────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const fromIndex = args.indexOf('--from')
  const fromTag = fromIndex !== -1 && args[fromIndex + 1] ? args[fromIndex + 1] : undefined

  const git = createRealGitAdapter()
  const result = analyze(git, fromTag)

  if (dryRun) {
    console.log('')
    console.log('Commit Analysis')
    console.log('────────────────')
    console.log(`  Current version: ${result.currentVersion}`)
    console.log(`  Commits analyzed: ${result.commitCount}`)
    console.log(`  Bump: ${result.bump ?? 'none (no releasable commits)'}`)
    if (result.newVersion) {
      console.log(`  New version: ${result.newVersion}`)
    }
    console.log('')
    if (result.changelog) {
      console.log('Changelog:')
      console.log(result.changelog)
    } else {
      console.log('No changelog to generate.')
    }
    return
  }

  // JSON output for CI consumption
  console.log(JSON.stringify(result))
}

// Only run main when executed directly (not imported)
if (import.meta.main) {
  main()
}
