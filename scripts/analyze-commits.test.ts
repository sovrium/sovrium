/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
  type GitAdapter,
  type ParsedCommit,
  analyze,
  analyzeCommits,
  bumpVersion,
  determineBump,
  generateChangelog,
  parseCommit,
} from './analyze-commits'

// ─── Helpers ──────────────────────────────────────────────────────

/** Build a raw commit string matching git log format */
function rawCommit(hash: string, subject: string, body = ''): string {
  return body ? `${hash} ${subject}\n${body}` : `${hash} ${subject}`
}

/** Build a minimal GitAdapter for testing */
function createTestGit(
  overrides: Partial<GitAdapter> & { version?: string; log?: string }
): GitAdapter {
  return {
    getLatestTag: overrides.getLatestTag ?? (() => 'v0.0.2'),
    getLog: overrides.getLog ?? (() => overrides.log ?? ''),
    getCurrentVersion: overrides.getCurrentVersion ?? (() => overrides.version ?? '0.0.2'),
  }
}

// ─── parseCommit ──────────────────────────────────────────────────

describe('parseCommit', () => {
  test('parses feat commit', () => {
    const result = parseCommit('abc1234 feat(auth): add OAuth2 support')
    expect(result).toEqual({
      hash: 'abc1234',
      type: 'feat',
      scope: 'auth',
      description: 'add OAuth2 support',
      breaking: false,
      body: '',
    })
  })

  test('parses fix commit without scope', () => {
    const result = parseCommit('def5678 fix: handle empty response')
    expect(result).toEqual({
      hash: 'def5678',
      type: 'fix',
      scope: null,
      description: 'handle empty response',
      breaking: false,
      body: '',
    })
  })

  test('parses breaking change with ! marker', () => {
    const result = parseCommit('aaa1111 feat(api)!: remove legacy endpoint')
    expect(result).toMatchObject({ breaking: true, type: 'feat' })
  })

  test('parses breaking change from body', () => {
    const raw = rawCommit(
      'bbb2222',
      'feat: new auth system',
      'BREAKING CHANGE: token format changed'
    )
    const result = parseCommit(raw)
    expect(result).toMatchObject({ breaking: true })
  })

  test('parses BREAKING-CHANGE with hyphen in body', () => {
    const raw = rawCommit('ccc3333', 'refactor: update API', 'BREAKING-CHANGE: new response format')
    const result = parseCommit(raw)
    expect(result).toMatchObject({ breaking: true })
  })

  test('filters merge commits', () => {
    expect(parseCommit('abc1234 Merge branch "feature" into main')).toBeNull()
    expect(parseCommit('abc1234 Merge pull request #123 from user/branch')).toBeNull()
  })

  test('filters [skip ci] commits', () => {
    expect(parseCommit('abc1234 chore: update deps [skip ci]')).toBeNull()
    expect(parseCommit('abc1234 fix: something [Skip CI]')).toBeNull()
  })

  test('filters release: commits', () => {
    expect(parseCommit('abc1234 release: 0.0.3')).toBeNull()
  })

  test('filters [TDD] commits', () => {
    expect(parseCommit('abc1234 [TDD] Implement spec-001')).toBeNull()
  })

  test('filters chore(release): commits', () => {
    expect(parseCommit('abc1234 chore(release): 0.0.3 [skip ci]')).toBeNull()
  })

  test('filters dependabot bump commits', () => {
    expect(parseCommit('abc1234 Bump typescript from 5.8.0 to 5.9.0')).toBeNull()
  })

  test('returns null for non-conventional commits', () => {
    expect(parseCommit('abc1234 just a random message')).toBeNull()
  })

  test('returns null for empty input', () => {
    expect(parseCommit('')).toBeNull()
  })

  test('handles perf type', () => {
    const result = parseCommit('abc1234 perf(db): optimize query plan')
    expect(result).toMatchObject({ type: 'perf', scope: 'db' })
  })

  test('handles chore type', () => {
    const result = parseCommit('abc1234 chore: update lockfile')
    expect(result).toMatchObject({ type: 'chore', scope: null })
  })
})

// ─── determineBump ────────────────────────────────────────────────

describe('determineBump', () => {
  test('returns null for empty commits', () => {
    expect(determineBump([])).toBeNull()
  })

  test('returns null for non-releasable commits only', () => {
    const commits: ParsedCommit[] = [
      { hash: 'a', type: 'chore', scope: null, description: 'update', breaking: false, body: '' },
      { hash: 'b', type: 'docs', scope: null, description: 'readme', breaking: false, body: '' },
      { hash: 'c', type: 'ci', scope: null, description: 'fix yaml', breaking: false, body: '' },
    ]
    expect(determineBump(commits)).toBeNull()
  })

  test('returns patch for fix only', () => {
    const commits: ParsedCommit[] = [
      { hash: 'a', type: 'fix', scope: null, description: 'bug', breaking: false, body: '' },
    ]
    expect(determineBump(commits)).toBe('patch')
  })

  test('returns minor for feat', () => {
    const commits: ParsedCommit[] = [
      { hash: 'a', type: 'feat', scope: null, description: 'new', breaking: false, body: '' },
    ]
    expect(determineBump(commits)).toBe('minor')
  })

  test('returns major for breaking change', () => {
    const commits: ParsedCommit[] = [
      { hash: 'a', type: 'fix', scope: null, description: 'fix', breaking: true, body: '' },
    ]
    expect(determineBump(commits)).toBe('major')
  })

  test('highest bump wins: feat > fix → minor', () => {
    const commits: ParsedCommit[] = [
      { hash: 'a', type: 'fix', scope: null, description: 'fix', breaking: false, body: '' },
      { hash: 'b', type: 'feat', scope: null, description: 'new', breaking: false, body: '' },
    ]
    expect(determineBump(commits)).toBe('minor')
  })

  test('breaking always wins: breaking fix > feat → major', () => {
    const commits: ParsedCommit[] = [
      { hash: 'a', type: 'feat', scope: null, description: 'new', breaking: false, body: '' },
      { hash: 'b', type: 'fix', scope: null, description: 'fix', breaking: true, body: '' },
    ]
    expect(determineBump(commits)).toBe('major')
  })

  test('perf triggers patch', () => {
    const commits: ParsedCommit[] = [
      { hash: 'a', type: 'perf', scope: null, description: 'fast', breaking: false, body: '' },
    ]
    expect(determineBump(commits)).toBe('patch')
  })
})

// ─── bumpVersion ──────────────────────────────────────────────────

describe('bumpVersion', () => {
  test('bumps patch', () => {
    expect(bumpVersion('0.0.2', 'patch')).toBe('0.0.3')
  })

  test('bumps minor (resets patch)', () => {
    expect(bumpVersion('0.0.2', 'minor')).toBe('0.1.0')
  })

  test('bumps major (resets minor and patch)', () => {
    expect(bumpVersion('0.0.2', 'major')).toBe('1.0.0')
  })

  test('handles higher versions', () => {
    expect(bumpVersion('1.5.9', 'patch')).toBe('1.5.10')
    expect(bumpVersion('1.5.9', 'minor')).toBe('1.6.0')
    expect(bumpVersion('1.5.9', 'major')).toBe('2.0.0')
  })
})

// ─── generateChangelog ────────────────────────────────────────────

describe('generateChangelog', () => {
  test('generates changelog with features and fixes', () => {
    const commits: ParsedCommit[] = [
      {
        hash: 'abc1234',
        type: 'feat',
        scope: 'auth',
        description: 'add OAuth2',
        breaking: false,
        body: '',
      },
      {
        hash: 'def5678',
        type: 'fix',
        scope: 'api',
        description: 'handle empty response',
        breaking: false,
        body: '',
      },
    ]

    const result = generateChangelog(commits, '0.1.0', '0.0.2', '2026-03-03')

    expect(result).toContain('## [0.1.0]')
    expect(result).toContain('compare/v0.0.2...v0.1.0')
    expect(result).toContain('### Features')
    expect(result).toContain('**auth**: add OAuth2')
    expect(result).toContain('abc1234')
    expect(result).toContain('### Bug Fixes')
    expect(result).toContain('**api**: handle empty response')
  })

  test('includes breaking changes section', () => {
    const commits: ParsedCommit[] = [
      {
        hash: 'aaa1111',
        type: 'feat',
        scope: 'api',
        description: 'remove legacy endpoint',
        breaking: true,
        body: '',
      },
    ]

    const result = generateChangelog(commits, '1.0.0', '0.1.0', '2026-03-03')
    expect(result).toContain('### BREAKING CHANGES')
    expect(result).toContain('remove legacy endpoint')
  })

  test('includes changelog-only types when present', () => {
    const commits: ParsedCommit[] = [
      {
        hash: 'abc1234',
        type: 'feat',
        scope: null,
        description: 'new feature',
        breaking: false,
        body: '',
      },
      {
        hash: 'def5678',
        type: 'refactor',
        scope: 'core',
        description: 'simplify logic',
        breaking: false,
        body: '',
      },
    ]

    const result = generateChangelog(commits, '0.1.0', '0.0.2', '2026-03-03')
    expect(result).toContain('### Features')
    expect(result).toContain('### Refactoring')
    expect(result).toContain('**core**: simplify logic')
  })

  test('formats commit without scope', () => {
    const commits: ParsedCommit[] = [
      {
        hash: 'abc1234',
        type: 'fix',
        scope: null,
        description: 'fix crash',
        breaking: false,
        body: '',
      },
    ]

    const result = generateChangelog(commits, '0.0.3', '0.0.2', '2026-03-03')
    expect(result).toContain('- fix crash ([abc1234]')
    expect(result).not.toContain('**')
  })
})

// ─── analyzeCommits ───────────────────────────────────────────────

describe('analyzeCommits', () => {
  test('parses multiple commits separated by null byte', () => {
    const raw = [
      rawCommit('abc1234', 'feat(auth): add OAuth2'),
      rawCommit('def5678', 'fix(api): handle empty response'),
    ].join('\0')

    const result = analyzeCommits(raw)
    expect(result).toHaveLength(2)
    expect(result[0]!.type).toBe('feat')
    expect(result[1]!.type).toBe('fix')
  })

  test('filters out non-conventional and skip-pattern commits', () => {
    const raw = [
      rawCommit('abc1234', 'feat: real feature'),
      rawCommit('bbb2222', 'Merge branch "main"'),
      rawCommit('ccc3333', 'chore: update [skip ci]'),
      rawCommit('ddd4444', 'just some message'),
    ].join('\0')

    const result = analyzeCommits(raw)
    expect(result).toHaveLength(1)
    expect(result[0]!.description).toBe('real feature')
  })

  test('returns empty for empty input', () => {
    expect(analyzeCommits('')).toHaveLength(0)
    expect(analyzeCommits('  ')).toHaveLength(0)
  })
})

// ─── analyze (integration with GitAdapter) ────────────────────────

describe('analyze', () => {
  test('returns null bump when no releasable commits', () => {
    const git = createTestGit({
      log: [rawCommit('abc1234', 'chore: update deps'), rawCommit('def5678', 'docs: readme')].join(
        '\0'
      ),
    })

    const result = analyze(git)
    expect(result.bump).toBeNull()
    expect(result.newVersion).toBeNull()
    expect(result.changelog).toBe('')
    expect(result.commitCount).toBe(2)
  })

  test('returns patch bump for fix commits', () => {
    const git = createTestGit({
      log: rawCommit('abc1234', 'fix(api): handle timeout'),
    })

    const result = analyze(git)
    expect(result.bump).toBe('patch')
    expect(result.currentVersion).toBe('0.0.2')
    expect(result.newVersion).toBe('0.0.3')
    expect(result.changelog).toContain('### Bug Fixes')
  })

  test('returns minor bump for feat commits', () => {
    const git = createTestGit({
      log: rawCommit('abc1234', 'feat: new feature'),
    })

    const result = analyze(git)
    expect(result.bump).toBe('minor')
    expect(result.newVersion).toBe('0.1.0')
  })

  test('returns major bump for breaking changes', () => {
    const git = createTestGit({
      log: rawCommit('abc1234', 'feat!: remove old API'),
    })

    const result = analyze(git)
    expect(result.bump).toBe('major')
    expect(result.newVersion).toBe('1.0.0')
  })

  test('uses custom fromTag when provided', () => {
    const captured: { from: string | null } = { from: null }
    const git = createTestGit({
      getLog: (from) => {
        captured.from = from
        return rawCommit('abc1234', 'fix: bug')
      },
    })

    analyze(git, 'v0.0.1')
    expect(captured.from).toBe('v0.0.1')
  })

  test('handles no tags (null from getLatestTag)', () => {
    const captured: { from: string | null } = { from: 'initial' }
    const git = createTestGit({
      getLatestTag: () => null,
      getLog: (from) => {
        captured.from = from
        return rawCommit('abc1234', 'feat: first feature')
      },
    })

    const result = analyze(git)
    expect(captured.from).toBeNull()
    expect(result.bump).toBe('minor')
  })

  test('handles empty git log', () => {
    const git = createTestGit({ log: '' })
    const result = analyze(git)
    expect(result.bump).toBeNull()
    expect(result.commitCount).toBe(0)
  })

  test('mixed types: highest bump wins', () => {
    const git = createTestGit({
      log: [
        rawCommit('aaa1111', 'fix: bug fix'),
        rawCommit('bbb2222', 'feat: new feature'),
        rawCommit('ccc3333', 'chore: cleanup'),
      ].join('\0'),
    })

    const result = analyze(git)
    expect(result.bump).toBe('minor')
    expect(result.commitCount).toBe(3)
  })
})
