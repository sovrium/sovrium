/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines -- Self-contained utility script */

/**
 * Spec Quality Analyzer
 *
 * Analyzes E2E test files (.spec.ts) for quality and generates a SPEC-STATE.md file
 * that serves as a single source of truth for test coverage and specification review.
 *
 * Quality checks:
 * - Test naming (descriptive, follows conventions)
 * - Spec IDs (APP-*, API-*, STATIC-*, etc.)
 * - GIVEN/WHEN/THEN structure in comments
 * - Test organization (@spec vs @regression tags)
 * - Coverage gaps and missing behaviors
 *
 * Usage:
 *   bun run scripts/analyze-specs.ts [options]
 *
 * Options:
 *   --filter=pattern   Filter files by regex pattern (e.g., --filter=version)
 *   --fixme            Show list of fixme tests for prioritization
 *   --no-error         Don't exit with error code on quality issues
 *   --verify-progress  Cross-reference with GitHub PRs/issues to detect discrepancies
 *
 * Output:
 *   - SPEC-STATE.md: Reviewable specification state document
 *   - Console: Quality report with issues and suggestions
 *
 * Examples:
 *   bun run analyze:specs                    # Full analysis
 *   bun run analyze:specs --filter=version   # Analyze only version specs
 *   bun run analyze:specs --fixme            # Show fixme tests to implement next
 */

import { readdir, readFile, writeFile, unlink, access } from 'node:fs/promises'
import { join, relative, basename } from 'node:path'
import * as prettier from 'prettier'

// =============================================================================
// Types
// =============================================================================

interface SpecTest {
  id: string | null
  name: string
  tag: '@spec' | '@regression' | null
  hasGiven: boolean
  hasWhen: boolean
  hasThen: boolean
  lineNumber: number
  isFixme: boolean
  rawContent: string
}

interface SpecFile {
  path: string
  relativePath: string
  feature: string
  tests: SpecTest[]
  issues: QualityIssue[]
  metadata: {
    hasDescribe: boolean
    describeLabel: string | null
    totalTests: number
    specTests: number
    regressionTests: number
    fixmeTests: number
    passingTests: number
  }
}

interface QualityIssue {
  type: 'error' | 'warning' | 'suggestion'
  code: string
  message: string
  line?: number
  testId?: string
}

interface SpecState {
  generatedAt: string
  summary: {
    totalFiles: number
    totalTests: number
    totalSpecs: number
    totalRegressions: number
    totalFixme: number
    totalPassing: number
    qualityScore: number
    duplicateSpecIds: number
    issuesByType: {
      errors: number
      warnings: number
      suggestions: number
    }
  }
  files: SpecFile[]
  coverageGaps: CoverageGap[]
  duplicateSpecIds: DuplicateSpecId[]
  tddAutomation: TDDAutomationStats
}

interface CoverageGap {
  feature: string
  missingBehaviors: string[]
  suggestion: string
}

interface DuplicateSpecId {
  specId: string
  locations: Array<{
    file: string
    line: number
    testName: string
  }>
}

interface TDDAutomationStats {
  totalFixed: number
  fixedLast24h: number
  fixedLast7d: number
  fixedLast30d: number
  avgFixesPerDay: number
  estimatedDaysRemaining: number | null
  estimatedCompletionDate: string | null
  recentFixes: Array<{
    specId: string
    date: string
    commitHash: string
  }>
}

interface GitHubReference {
  type: 'pr' | 'issue' | 'commit'
  number?: number
  hash?: string
  title: string
  specId: string
  date: string
  url?: string
}

interface ProgressDiscrepancy {
  specId: string
  status: 'missing-in-codebase' | 'still-fixme' | 'fixed-but-not-tracked'
  references: GitHubReference[]
  suggestion: string
}

interface VerificationResult {
  allReferences: GitHubReference[]
  discrepancies: ProgressDiscrepancy[]
  fixedSpecIds: Set<string>
}

interface DomainSummary {
  domain: string
  totalFiles: number
  totalTests: number
  passingTests: number
  fixmeTests: number
  progressPercent: number
  status: '🟢' | '🟡' | '🔴'
  files: SpecFile[]
}

// =============================================================================
// Constants
// =============================================================================

const SPEC_ID_PATTERN = /^([A-Z]+-[A-Z0-9-]+-\d{3})/
const GIVEN_PATTERN = /\/\/\s*GIVEN/i
const WHEN_PATTERN = /\/\/\s*(WHEN|GIVEN\/WHEN|WHEN\/THEN)/i
const THEN_PATTERN = /\/\/\s*(THEN|WHEN\/THEN)/i
// Implicit THEN: expect().rejects or expect().resolves patterns (assertion is built into the expect)
const IMPLICIT_THEN_PATTERN = /\.\s*(rejects|resolves)\s*\.\s*(toThrow|toBe|toEqual|toMatch)/
const TEST_PATTERN = /test\s*\(\s*['"`]([^'"`]+)['"`]/g
const TEST_FIXME_PATTERN = /test\.fixme\s*\(\s*['"`]([^'"`]+)['"`]/g
const DESCRIBE_PATTERN = /test\.describe\s*\(\s*['"`]([^'"`]+)['"`]/
const TAG_PATTERN = /\{\s*tag:\s*['"`](@spec|@regression)['"`]\s*\}/
const TODO_PATTERN = /\/\/\s*TODO[:\s](.+?)(?:\n|$)/gi

const SPECS_DIR = join(process.cwd(), 'specs')
const OUTPUT_FILE = join(process.cwd(), 'SPEC-PROGRESS.md')
const OLD_OUTPUT_FILE = join(process.cwd(), 'SPEC-STATE.md') // For migration
const README_FILE = join(process.cwd(), 'README.md')

// =============================================================================
// Analysis Functions
// =============================================================================

async function findSpecFiles(dir: string): Promise<string[]> {
  const files: string[] = []

  async function walk(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)

      if (entry.isDirectory()) {
        // Skip __snapshots__ directories
        if (entry.name !== '__snapshots__') {
          await walk(fullPath)
        }
      } else if (entry.name.endsWith('.spec.ts')) {
        files.push(fullPath)
      }
    }
  }

  await walk(dir)
  return files.sort()
}

function extractTests(content: string, _filePath: string): SpecTest[] {
  const tests: SpecTest[] = []

  // Find all test declarations
  let match: RegExpExecArray | null

  // Reset regex state
  TEST_PATTERN.lastIndex = 0
  TEST_FIXME_PATTERN.lastIndex = 0

  // Find regular tests
  while ((match = TEST_PATTERN.exec(content)) !== null) {
    const testName = match[1]
    if (!testName) continue
    const matchIndex = match.index

    // Find line number
    const beforeMatch = content.substring(0, matchIndex)
    const lineNumber = beforeMatch.split('\n').length

    // Extract the full test block - need to find the test function body, not just options
    // Test structure: test('name', { options }, async () => { ... })
    // We need to find the outermost closing paren that matches test(
    const testStart = matchIndex
    let parenCount = 0
    let testEnd = testStart
    let foundFirstParen = false

    for (let i = testStart; i < content.length; i++) {
      if (content[i] === '(') {
        parenCount++
        foundFirstParen = true
      } else if (content[i] === ')') {
        parenCount--
      }

      if (foundFirstParen && parenCount === 0) {
        testEnd = i + 1
        break
      }
    }

    const rawContent = content.substring(testStart, testEnd)

    // Check for GIVEN/WHEN/THEN
    const hasGiven = GIVEN_PATTERN.test(rawContent)
    const hasWhen = WHEN_PATTERN.test(rawContent)
    // THEN can be explicit comment or implicit via expect().rejects/.resolves pattern
    const hasThen = THEN_PATTERN.test(rawContent) || IMPLICIT_THEN_PATTERN.test(rawContent)

    // Extract spec ID from test name
    const idMatch = testName.match(SPEC_ID_PATTERN)
    const id = idMatch?.[1] ?? null

    // Check for tag
    const tagMatch = rawContent.match(TAG_PATTERN)
    const tag = tagMatch ? (tagMatch[1] as '@spec' | '@regression') : null

    // Check if it's a fixme test
    const isFixme = false

    tests.push({
      id,
      name: testName as string,
      tag,
      hasGiven,
      hasWhen,
      hasThen,
      lineNumber,
      isFixme,
      rawContent,
    })
  }

  // Find fixme tests
  while ((match = TEST_FIXME_PATTERN.exec(content)) !== null) {
    const testName = match[1]
    if (!testName) continue
    const matchIndex = match.index

    const beforeMatch = content.substring(0, matchIndex)
    const lineNumber = beforeMatch.split('\n').length

    // Extract the full test block using parenthesis counting (same as regular tests)
    const testStart = matchIndex
    let parenCount = 0
    let testEnd = testStart
    let foundFirstParen = false

    for (let i = testStart; i < content.length; i++) {
      if (content[i] === '(') {
        parenCount++
        foundFirstParen = true
      } else if (content[i] === ')') {
        parenCount--
      }

      if (foundFirstParen && parenCount === 0) {
        testEnd = i + 1
        break
      }
    }

    const rawContent = content.substring(testStart, testEnd)

    const hasGiven = GIVEN_PATTERN.test(rawContent)
    const hasWhen = WHEN_PATTERN.test(rawContent)
    // THEN can be explicit comment or implicit via expect().rejects/.resolves pattern
    const hasThen = THEN_PATTERN.test(rawContent) || IMPLICIT_THEN_PATTERN.test(rawContent)

    const idMatch = testName.match(SPEC_ID_PATTERN)
    const id = idMatch?.[1] ?? null

    const tagMatch = rawContent.match(TAG_PATTERN)
    const tag = tagMatch ? (tagMatch[1] as '@spec' | '@regression') : null

    tests.push({
      id,
      name: testName as string,
      tag,
      hasGiven,
      hasWhen,
      hasThen,
      lineNumber,
      isFixme: true,
      rawContent,
    })
  }

  return tests.sort((a, b) => a.lineNumber - b.lineNumber)
}

function analyzeQuality(file: SpecFile): QualityIssue[] {
  const issues: QualityIssue[] = []

  for (const test of file.tests) {
    // Check for spec ID - required for both @spec and @regression tests
    if (!test.id && (test.tag === '@spec' || test.tag === '@regression')) {
      issues.push({
        type: 'error',
        code: 'MISSING_SPEC_ID',
        message: `Test missing spec ID (expected format: APP-FEATURE-001)`,
        line: test.lineNumber,
        testId: test.name,
      })
    }

    // Check for GIVEN/WHEN/THEN structure (skip fixme tests - they're placeholders)
    if (test.tag === '@spec' && !test.isFixme) {
      if (!test.hasGiven) {
        issues.push({
          type: 'warning',
          code: 'MISSING_GIVEN',
          message: `Test missing GIVEN comment (setup context)`,
          line: test.lineNumber,
          testId: test.id || test.name,
        })
      }
      if (!test.hasWhen) {
        issues.push({
          type: 'warning',
          code: 'MISSING_WHEN',
          message: `Test missing WHEN comment (action)`,
          line: test.lineNumber,
          testId: test.id || test.name,
        })
      }
      if (!test.hasThen) {
        issues.push({
          type: 'warning',
          code: 'MISSING_THEN',
          message: `Test missing THEN comment (assertion)`,
          line: test.lineNumber,
          testId: test.id || test.name,
        })
      }
    }

    // Check for tag - tests must have @spec or @regression tag
    if (!test.tag && !test.isFixme) {
      issues.push({
        type: 'error',
        code: 'MISSING_TAG',
        message: `Test missing tag (@spec or @regression)`,
        line: test.lineNumber,
        testId: test.id || test.name,
      })
    }

    // Check test name quality
    if (test.name.length < 20) {
      issues.push({
        type: 'suggestion',
        code: 'SHORT_TEST_NAME',
        message: `Test name is too short - consider being more descriptive`,
        line: test.lineNumber,
        testId: test.id || test.name,
      })
    }

    // Check for vague test names
    const vaguePatterns = [/^should work$/i, /^test\s+\d+$/i, /^it works$/i, /^basic test$/i]
    if (vaguePatterns.some((p) => p.test(test.name))) {
      issues.push({
        type: 'error',
        code: 'VAGUE_TEST_NAME',
        message: `Test name is too vague - describe the specific behavior`,
        line: test.lineNumber,
        testId: test.id || test.name,
      })
    }

    // Check for TODO comments in test
    TODO_PATTERN.lastIndex = 0
    let todoMatch: RegExpExecArray | null
    while ((todoMatch = TODO_PATTERN.exec(test.rawContent)) !== null) {
      const todoText = todoMatch[1]?.trim() || 'No description'
      issues.push({
        type: 'warning',
        code: 'TODO_IN_TEST',
        message: `TODO: ${todoText}`,
        line: test.lineNumber,
        testId: test.id || test.name,
      })
    }
  }

  // Check file-level issues
  const specTests = file.tests.filter((t) => t.tag === '@spec')
  const regressionTests = file.tests.filter((t) => t.tag === '@regression')

  if (specTests.length > 0 && regressionTests.length === 0) {
    issues.push({
      type: 'suggestion',
      code: 'MISSING_REGRESSION',
      message: `File has @spec tests but no @regression test for consolidated workflow`,
    })
  }

  // Check for sequential spec IDs (include both @spec and @regression tests)
  const allTestIds = file.tests.map((t) => t.id).filter(Boolean) as string[]
  if (allTestIds.length > 1) {
    const idNumbers = allTestIds.map((id) => {
      const numMatch = id.match(/(\d{3})$/)
      return numMatch?.[1] ? parseInt(numMatch[1], 10) : 0
    })

    for (let i = 1; i < idNumbers.length; i++) {
      const current = idNumbers[i]
      const previous = idNumbers[i - 1]
      if (current !== undefined && previous !== undefined && current !== previous + 1) {
        issues.push({
          type: 'suggestion',
          code: 'NON_SEQUENTIAL_IDS',
          message: `Spec IDs are not sequential (gap between ${allTestIds[i - 1]} and ${allTestIds[i]})`,
        })
        break
      }
    }
  }

  return issues
}

function extractFeatureName(filePath: string): string {
  const relativePath = relative(SPECS_DIR, filePath)
  const parts = relativePath.replace(/\.spec\.ts$/, '').split('/')

  // Remove common prefixes
  if (parts[0] === 'app' || parts[0] === 'api' || parts[0] === 'static') {
    parts.shift()
  }

  return parts.join(' > ') || basename(filePath, '.spec.ts')
}

async function analyzeFile(filePath: string): Promise<SpecFile> {
  const content = await readFile(filePath, 'utf-8')
  const relativePath = relative(SPECS_DIR, filePath)
  const feature = extractFeatureName(filePath)

  // Extract describe label
  const describeMatch = content.match(DESCRIBE_PATTERN)
  const describeLabel = describeMatch?.[1] ?? null

  const tests = extractTests(content, filePath)
  const specTests = tests.filter((t) => t.tag === '@spec')
  const regressionTests = tests.filter((t) => t.tag === '@regression')
  const fixmeTests = tests.filter((t) => t.isFixme)
  const passingTests = tests.filter((t) => !t.isFixme)

  const file: SpecFile = {
    path: filePath,
    relativePath,
    feature,
    tests,
    issues: [],
    metadata: {
      hasDescribe: !!describeLabel,
      describeLabel,
      totalTests: tests.length,
      specTests: specTests.length,
      regressionTests: regressionTests.length,
      fixmeTests: fixmeTests.length,
      passingTests: passingTests.length,
    },
  }

  file.issues = analyzeQuality(file)

  return file
}

function calculateQualityScore(files: SpecFile[]): number {
  if (files.length === 0) return 100

  let totalPoints = 0
  let maxPoints = 0

  for (const file of files) {
    // Points for each test
    for (const test of file.tests) {
      maxPoints += 100

      let testPoints = 0

      // Has spec ID: 20 points
      if (test.id) testPoints += 20

      // Has tag: 10 points
      if (test.tag) testPoints += 10

      // Has GIVEN: 20 points
      if (test.hasGiven) testPoints += 20

      // Has WHEN: 20 points
      if (test.hasWhen) testPoints += 20

      // Has THEN: 20 points
      if (test.hasThen) testPoints += 20

      // Not fixme: 10 points
      if (!test.isFixme) testPoints += 10

      totalPoints += testPoints
    }

    // Deduct for issues
    for (const issue of file.issues) {
      if (issue.type === 'error') maxPoints += 10
      else if (issue.type === 'warning') maxPoints += 5
    }
  }

  return maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 100
}

function detectCoverageGaps(files: SpecFile[]): CoverageGap[] {
  const gaps: CoverageGap[] = []

  // Group files by feature area
  const featureAreas = new Map<string, SpecFile[]>()

  for (const file of files) {
    const area = file.relativePath.split('/')[0] || 'root'
    if (!featureAreas.has(area)) {
      featureAreas.set(area, [])
    }
    featureAreas.get(area)!.push(file)
  }

  // Check for common patterns
  for (const [area, areaFiles] of featureAreas) {
    const allTests = areaFiles.flatMap((f) => f.tests)
    const testNames = allTests.map((t) => t.name.toLowerCase())

    // Check for missing edge cases
    const hasErrorCases = testNames.some(
      (n) => n.includes('error') || n.includes('invalid') || n.includes('fail')
    )
    const hasEmptyCases = testNames.some(
      (n) => n.includes('empty') || n.includes('missing') || n.includes('undefined')
    )
    const hasBoundaryCases = testNames.some(
      (n) => n.includes('max') || n.includes('min') || n.includes('limit') || n.includes('boundary')
    )

    const missingBehaviors: string[] = []

    if (!hasErrorCases) {
      missingBehaviors.push('Error handling scenarios')
    }
    if (!hasEmptyCases) {
      missingBehaviors.push('Empty/missing data scenarios')
    }
    if (!hasBoundaryCases) {
      missingBehaviors.push('Boundary/edge cases')
    }

    if (missingBehaviors.length > 0) {
      gaps.push({
        feature: area,
        missingBehaviors,
        suggestion: `Consider adding tests for: ${missingBehaviors.join(', ')}`,
      })
    }
  }

  return gaps
}

/**
 * Detect duplicate spec IDs across all files.
 * Each spec ID should be unique across the entire test suite.
 */
function detectDuplicateSpecIds(files: SpecFile[]): DuplicateSpecId[] {
  const specIdMap = new Map<string, Array<{ file: string; line: number; testName: string }>>()

  // Collect all spec IDs with their locations
  for (const file of files) {
    for (const test of file.tests) {
      if (test.id) {
        if (!specIdMap.has(test.id)) {
          specIdMap.set(test.id, [])
        }
        specIdMap.get(test.id)!.push({
          file: file.relativePath,
          line: test.lineNumber,
          testName: test.name,
        })
      }
    }
  }

  // Find duplicates (spec IDs that appear more than once)
  const duplicates: DuplicateSpecId[] = []

  for (const [specId, locations] of specIdMap) {
    if (locations.length > 1) {
      duplicates.push({ specId, locations })
    }
  }

  return duplicates.sort((a, b) => a.specId.localeCompare(b.specId))
}

/**
 * Calculate TDD automation statistics from git history.
 * Looks for commits with "fix: implement" pattern (TDD workflow commits).
 */
async function calculateTDDAutomationStats(totalFixme: number): Promise<TDDAutomationStats> {
  const { exec } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const execAsync = promisify(exec)

  // Pattern to match any commit containing a spec ID (e.g., APP-XXX-001)
  // Matches: "fix: implement APP-XXX-001", "test: activate APP-XXX-001", "feat: implement APP-XXX-001", etc.
  const specIdPattern = /([A-Z]+-[A-Z0-9-]+-\d{3})/

  try {
    // Get all spec-related commits in the last 90 days
    // Uses extended regex to match conventional commit types with spec IDs
    // Includes: fix:, fix(test):, test:, feat:, refactor:, etc.
    const { stdout } = await execAsync(
      'git log --oneline --since="90 days ago" --extended-regexp --grep="^(fix|test|feat|refactor|chore)(\\([^)]*\\))?:.*[A-Z]+-[A-Z0-9-]+-[0-9]{3}" --format="%H|%aI|%s"',
      { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 }
    )

    const commits = stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, date, ...messageParts] = line.split('|')
        const message = messageParts.join('|')
        const match = message?.match(specIdPattern)
        return {
          hash: hash || '',
          date: date || '',
          specId: match?.[1] || null,
        }
      })
      .filter((c) => c.specId !== null) as Array<{
      hash: string
      date: string
      specId: string
    }>

    // Calculate time-based metrics
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const fixedLast24h = commits.filter((c) => new Date(c.date) >= oneDayAgo).length
    const fixedLast7d = commits.filter((c) => new Date(c.date) >= sevenDaysAgo).length
    const fixedLast30d = commits.filter((c) => new Date(c.date) >= thirtyDaysAgo).length

    // Calculate average fixes per day (based on 30-day window for stability)
    const avgFixesPerDay = fixedLast30d / 30

    // Estimate remaining time
    let estimatedDaysRemaining: number | null = null
    let estimatedCompletionDate: string | null = null

    if (avgFixesPerDay > 0 && totalFixme > 0) {
      estimatedDaysRemaining = Math.ceil(totalFixme / avgFixesPerDay)
      const completionDate = new Date(now.getTime() + estimatedDaysRemaining * 24 * 60 * 60 * 1000)
      estimatedCompletionDate = completionDate.toISOString().split('T')[0] || null
    }

    // Get recent fixes (last 20)
    const recentFixes = commits.slice(0, 20).map((c) => ({
      specId: c.specId,
      date: c.date.replace('T', ' ').substring(0, 16),
      commitHash: c.hash.substring(0, 7),
    }))

    return {
      totalFixed: commits.length,
      fixedLast24h,
      fixedLast7d,
      fixedLast30d,
      avgFixesPerDay: Math.round(avgFixesPerDay * 100) / 100,
      estimatedDaysRemaining,
      estimatedCompletionDate,
      recentFixes,
    }
  } catch {
    // If git command fails, return empty stats
    return {
      totalFixed: 0,
      fixedLast24h: 0,
      fixedLast7d: 0,
      fixedLast30d: 0,
      avgFixesPerDay: 0,
      estimatedDaysRemaining: null,
      estimatedCompletionDate: null,
      recentFixes: [],
    }
  }
}

/**
 * Verify progress by cross-referencing GitHub PRs, issues, and commits.
 * Detects discrepancies between what's been fixed and what's still marked as fixme.
 */
async function verifyProgressFromGitHub(
  fixmeSpecIds: Set<string>,
  passingSpecIds: Set<string>
): Promise<VerificationResult> {
  const { exec } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const execAsync = promisify(exec)

  const specIdPattern = /([A-Z]+-[A-Z0-9-]+-\d{3})/g
  const allReferences: GitHubReference[] = []
  const fixedSpecIds = new Set<string>()

  try {
    // 1. Fetch merged PRs with spec IDs (last 90 days)
    const { stdout: prOutput } = await execAsync(
      'gh pr list --state merged --limit 500 --json number,title,mergedAt,url',
      { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 }
    )

    const prs = JSON.parse(prOutput) as Array<{
      number: number
      title: string
      mergedAt: string
      url: string
    }>

    for (const pr of prs) {
      const matches = pr.title.matchAll(specIdPattern)
      for (const match of matches) {
        const specId = match[1]
        if (!specId) continue
        allReferences.push({
          type: 'pr',
          number: pr.number,
          title: pr.title,
          specId,
          date: pr.mergedAt,
          url: pr.url,
        })
        fixedSpecIds.add(specId)
      }
    }

    // 2. Fetch closed issues with tdd-spec:completed label
    const { stdout: issueOutput } = await execAsync(
      'gh issue list --state closed --label "tdd-spec:completed" --limit 500 --json number,title,closedAt,url',
      { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 }
    )

    const issues = JSON.parse(issueOutput) as Array<{
      number: number
      title: string
      closedAt: string
      url: string
    }>

    for (const issue of issues) {
      const matches = issue.title.matchAll(specIdPattern)
      for (const match of matches) {
        const specId = match[1]
        if (!specId) continue
        allReferences.push({
          type: 'issue',
          number: issue.number,
          title: issue.title,
          specId,
          date: issue.closedAt,
          url: issue.url,
        })
        fixedSpecIds.add(specId)
      }
    }

    // 3. Fetch commits with spec IDs (last 90 days) - all conventional commit types
    const { stdout: commitOutput } = await execAsync(
      'git log --oneline --since="90 days ago" --extended-regexp --grep="[A-Z]+-[A-Z0-9-]+-[0-9]{3}" --format="%H|%aI|%s"',
      { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 }
    )

    const commitLines = commitOutput.trim().split('\n').filter(Boolean)
    for (const line of commitLines) {
      const [hash, date, ...messageParts] = line.split('|')
      const message = messageParts.join('|')
      if (!hash || !date || !message) continue

      const matches = message.matchAll(specIdPattern)
      for (const match of matches) {
        const specId = match[1]
        if (!specId) continue
        allReferences.push({
          type: 'commit',
          hash: hash.substring(0, 7),
          title: message,
          specId,
          date,
        })
        fixedSpecIds.add(specId)
      }
    }

    // 4. Detect discrepancies
    const discrepancies: ProgressDiscrepancy[] = []

    // Find specs that have been fixed (in PRs/commits) but are still marked as fixme
    for (const specId of fixedSpecIds) {
      if (fixmeSpecIds.has(specId)) {
        const refs = allReferences.filter((r) => r.specId === specId)
        discrepancies.push({
          specId,
          status: 'still-fixme',
          references: refs,
          suggestion: `Spec ${specId} has been fixed (see PRs/commits) but is still marked as .fixme() in the test file`,
        })
      }
    }

    // Find specs that are passing but not tracked in TDD automation
    for (const specId of passingSpecIds) {
      if (!fixedSpecIds.has(specId)) {
        // This is normal for specs that were never fixme - skip
        // Only flag if we expected it to be tracked
      }
    }

    return {
      allReferences,
      discrepancies,
      fixedSpecIds,
    }
  } catch (error) {
    console.warn('Warning: Could not verify progress from GitHub:', error)
    return {
      allReferences: [],
      discrepancies: [],
      fixedSpecIds: new Set(),
    }
  }
}

// =============================================================================
// Output Generation
// =============================================================================

/**
 * Calculate domain-level summaries for the Table of Contents and rollup display.
 */
function calculateDomainSummaries(files: SpecFile[]): DomainSummary[] {
  const byDomain = new Map<string, SpecFile[]>()

  for (const file of files) {
    const domain = file.relativePath.split('/')[0] || 'root'
    if (!byDomain.has(domain)) {
      byDomain.set(domain, [])
    }
    byDomain.get(domain)!.push(file)
  }

  const summaries: DomainSummary[] = []

  for (const [domain, domainFiles] of byDomain) {
    const totalTests = domainFiles.reduce((sum, f) => sum + f.metadata.totalTests, 0)
    const passingTests = domainFiles.reduce((sum, f) => sum + f.metadata.passingTests, 0)
    const fixmeTests = domainFiles.reduce((sum, f) => sum + f.metadata.fixmeTests, 0)
    const progressPercent = totalTests > 0 ? Math.round((passingTests / totalTests) * 100) : 100

    // Determine status based on progress and issues
    const hasErrors = domainFiles.some((f) => f.issues.some((i) => i.type === 'error'))
    const hasWarnings = domainFiles.some((f) => f.issues.some((i) => i.type === 'warning'))

    let status: '🟢' | '🟡' | '🔴'
    if (hasErrors) {
      status = '🔴'
    } else if (progressPercent === 100 && !hasWarnings) {
      status = '🟢'
    } else if (progressPercent >= 80 || (progressPercent === 100 && hasWarnings)) {
      status = '🟡'
    } else {
      status = '🟡'
    }

    summaries.push({
      domain: domain.toUpperCase(),
      totalFiles: domainFiles.length,
      totalTests,
      passingTests,
      fixmeTests,
      progressPercent,
      status,
      files: domainFiles,
    })
  }

  // Sort by domain name for consistent ordering
  return summaries.sort((a, b) => a.domain.localeCompare(b.domain))
}

/**
 * Get a human-readable status label based on progress.
 */
function getStatusLabel(progressPercent: number, hasIssues: boolean): string {
  if (progressPercent === 100 && !hasIssues) return 'Complete'
  if (progressPercent === 100 && hasIssues) return 'Review Needed'
  if (progressPercent >= 80) return 'Almost Done'
  if (progressPercent >= 50) return 'In Progress'
  return 'Early Stage'
}

/**
 * Get overall health status for executive summary.
 */
function getOverallHealth(
  progressPercent: number,
  errors: number,
  avgFixesPerDay: number
): { emoji: string; label: string } {
  if (errors > 0) return { emoji: '🔴', label: 'Blocked' }
  if (avgFixesPerDay >= 25 && progressPercent >= 50) return { emoji: '🟢', label: 'On Track' }
  if (avgFixesPerDay >= 15) return { emoji: '🟡', label: 'Progressing' }
  return { emoji: '🟡', label: 'Needs Attention' }
}

function generateMarkdown(state: SpecState): string {
  const lines: string[] = []

  // Calculate domain summaries for TOC and rollups
  const domainSummaries = calculateDomainSummaries(state.files)

  // Calculate key metrics
  const progressPercent = Math.round(
    (state.summary.totalPassing / Math.max(state.summary.totalTests, 1)) * 100
  )
  const progressFilled = Math.round(progressPercent / 5)
  const progressEmpty = 20 - progressFilled

  // Get overall health status
  const health = getOverallHealth(
    progressPercent,
    state.summary.issuesByType.errors,
    state.tddAutomation.avgFixesPerDay
  )

  // Calculate ETA text
  let etaText = 'Unknown'
  if (state.tddAutomation.estimatedDaysRemaining !== null) {
    const days = state.tddAutomation.estimatedDaysRemaining
    etaText =
      days === 0
        ? 'Less than 1 day'
        : days === 1
          ? '~1 day'
          : days < 7
            ? `~${days} days`
            : days < 30
              ? `~${Math.ceil(days / 7)} weeks`
              : `~${Math.ceil(days / 30)} months`
  }

  // ==========================================================================
  // HEADER
  // ==========================================================================
  lines.push('# Spec Progress Report')
  lines.push('')
  lines.push(`> Generated: ${state.generatedAt}`)
  lines.push('>')
  lines.push('> Auto-generated by `bun run analyze:specs` • Track test coverage and TDD progress')
  lines.push('')

  // ==========================================================================
  // EXECUTIVE SUMMARY
  // ==========================================================================
  lines.push('## 🎯 Executive Summary')
  lines.push('')
  lines.push(
    `**Current Status**: ${progressPercent}% Complete (${state.summary.totalPassing}/${state.summary.totalTests} tests passing)`
  )
  lines.push(`**Quality Score**: ${state.summary.qualityScore}%`)
  if (state.tddAutomation.estimatedCompletionDate) {
    lines.push(
      `**Estimated Completion**: ${state.tddAutomation.estimatedCompletionDate} (${etaText})`
    )
  }
  lines.push(`**Daily Velocity**: ${state.tddAutomation.avgFixesPerDay} specs/day`)
  lines.push('')

  // Key Metrics at a Glance table
  lines.push('### Key Metrics at a Glance')
  lines.push('')
  lines.push('| Category | Metric | Status |')
  lines.push('|----------|--------|--------|')
  lines.push(
    `| **Overall Progress** | [${'█'.repeat(progressFilled)}${'░'.repeat(progressEmpty)}] ${progressPercent}% | ${health.emoji} ${health.label} |`
  )
  lines.push(
    `| **TDD Automation** | ${state.tddAutomation.avgFixesPerDay} specs/day | ${state.tddAutomation.avgFixesPerDay >= 25 ? '🟢 Healthy' : state.tddAutomation.avgFixesPerDay >= 15 ? '🟡 Moderate' : '🔴 Slow'} |`
  )
  lines.push(
    `| **Quality** | ${state.summary.qualityScore}% score | ${state.summary.qualityScore >= 90 ? '🟢 Excellent' : state.summary.qualityScore >= 75 ? '🟡 Good' : '🔴 Needs Work'} |`
  )
  lines.push(
    `| **Blockers** | ${state.summary.issuesByType.errors} errors, ${state.summary.issuesByType.warnings} warnings | ${state.summary.issuesByType.errors === 0 ? '🟢 Clear' : '🔴 Blocked'} |`
  )
  lines.push('')

  // ==========================================================================
  // TABLE OF CONTENTS
  // ==========================================================================
  lines.push('## 📑 Table of Contents')
  lines.push('')
  lines.push('- [Executive Summary](#-executive-summary)')
  lines.push('- [Next Steps](#-next-steps)')
  lines.push('- [Detailed Metrics](#-detailed-metrics)')
  lines.push('- [TDD Automation](#-tdd-automation)')
  lines.push('- [Feature Breakdown](#-feature-breakdown)')
  for (const domain of domainSummaries) {
    lines.push(
      `  - [${domain.domain}](#${domain.domain.toLowerCase()}) • ${domain.status} ${domain.progressPercent}% (${domain.totalFiles} files)`
    )
  }
  lines.push('- [Quick Reference](#-quick-reference)')
  lines.push('')

  // ==========================================================================
  // NEXT STEPS (Actionable)
  // ==========================================================================
  lines.push('## 🎯 Next Steps')
  lines.push('')

  // Collect all issues
  const allIssues = state.files.flatMap((f) =>
    f.issues.map((i) => ({ ...i, file: f.relativePath }))
  )
  const errors = allIssues.filter((i) => i.type === 'error')
  const warnings = allIssues.filter((i) => i.type === 'warning')

  // Priority 1 - Immediate Action
  if (errors.length > 0 || state.duplicateSpecIds.length > 0) {
    lines.push('### 🚨 Priority 1 - Immediate Action')
    lines.push('')
    if (state.duplicateSpecIds.length > 0) {
      lines.push(
        `- **Fix ${state.duplicateSpecIds.length} duplicate spec IDs** - Critical for TDD queue`
      )
      for (const dup of state.duplicateSpecIds.slice(0, 3)) {
        lines.push(`  - \`${dup.specId}\` appears ${dup.locations.length} times`)
      }
    }
    for (const error of errors.slice(0, 5)) {
      const location = error.line ? `:${error.line}` : ''
      lines.push(`- ❌ **${error.code}** in \`${error.file}${location}\``)
    }
    lines.push('')
  }

  // Priority 2 - This Week
  if (warnings.length > 0 || state.coverageGaps.length > 0) {
    lines.push('### ⚠️ Priority 2 - This Week')
    lines.push('')
    for (const warning of warnings.slice(0, 5)) {
      const location = warning.line ? `:${warning.line}` : ''
      lines.push(`- **Fix warning** in \`${warning.file}${location}\` (${warning.code})`)
    }
    if (state.coverageGaps.length > 0) {
      lines.push(
        `- **Review ${state.coverageGaps.length} coverage gaps** - Add missing test scenarios`
      )
    }
    lines.push('')
  }

  // Priority 3 - Ongoing
  lines.push('### 📋 Priority 3 - Ongoing')
  lines.push('')
  const requiredVelocity =
    state.tddAutomation.estimatedDaysRemaining !== null &&
    state.tddAutomation.estimatedDaysRemaining > 0
      ? Math.ceil(state.summary.totalFixme / state.tddAutomation.estimatedDaysRemaining)
      : state.tddAutomation.avgFixesPerDay
  lines.push(
    `- **Maintain velocity** - Need ${requiredVelocity} specs/day to hit ETA (current: ${state.tddAutomation.avgFixesPerDay})`
  )
  lines.push(`- **${state.summary.totalFixme} tests remaining** - TDD automation running`)
  lines.push(
    `- **Quality gate** - Keep quality score above 85% (current: ${state.summary.qualityScore}%)`
  )
  lines.push('')

  // ==========================================================================
  // DETAILED METRICS
  // ==========================================================================
  lines.push('## 📊 Detailed Metrics')
  lines.push('')
  lines.push('| Metric | Value |')
  lines.push('|--------|-------|')
  lines.push(`| **Quality Score** | ${state.summary.qualityScore}% |`)
  lines.push(`| Total Files | ${state.summary.totalFiles} |`)
  lines.push(`| Total Tests | ${state.summary.totalTests} |`)
  lines.push(`| @spec Tests | ${state.summary.totalSpecs} |`)
  lines.push(`| @regression Tests | ${state.summary.totalRegressions} |`)
  lines.push(`| ✅ Passing | ${state.summary.totalPassing} |`)
  lines.push(`| ⏸️ Fixme | ${state.summary.totalFixme} |`)
  lines.push(`| ❌ Errors | ${state.summary.issuesByType.errors} |`)
  lines.push(`| ⚠️ Warnings | ${state.summary.issuesByType.warnings} |`)
  lines.push(`| 💡 Suggestions | ${state.summary.issuesByType.suggestions} |`)
  lines.push(`| 🔄 Duplicate IDs | ${state.summary.duplicateSpecIds} |`)
  lines.push('')

  // Progress bar
  lines.push(
    `**Progress:** [${'█'.repeat(progressFilled)}${'░'.repeat(progressEmpty)}] ${progressPercent}% (${state.summary.totalPassing}/${state.summary.totalTests})`
  )
  lines.push('')

  // ==========================================================================
  // TDD AUTOMATION
  // ==========================================================================
  if (state.tddAutomation.totalFixed > 0 || state.summary.totalFixme > 0) {
    lines.push('## 🤖 TDD Automation')
    lines.push('')

    if (state.tddAutomation.estimatedDaysRemaining !== null) {
      lines.push(`**⏱️ Estimated Time Remaining:** ${etaText}`)
      if (state.tddAutomation.estimatedCompletionDate) {
        lines.push(`**📅 Estimated Completion:** ${state.tddAutomation.estimatedCompletionDate}`)
      }
      lines.push('')
    }

    lines.push('| Metric | Value |')
    lines.push('|--------|-------|')
    lines.push(`| Tests Fixed (90 days) | ${state.tddAutomation.totalFixed} |`)
    lines.push(`| Fixed Last 24h | ${state.tddAutomation.fixedLast24h} |`)
    lines.push(`| Fixed Last 7d | ${state.tddAutomation.fixedLast7d} |`)
    lines.push(`| Fixed Last 30d | ${state.tddAutomation.fixedLast30d} |`)
    lines.push(`| Avg Fixes/Day | ${state.tddAutomation.avgFixesPerDay} |`)
    lines.push(`| Remaining | ${state.summary.totalFixme} |`)
    lines.push('')

    // Recent fixes
    if (state.tddAutomation.recentFixes.length > 0) {
      lines.push('<details>')
      lines.push('<summary>Recent Fixes (last 20)</summary>')
      lines.push('')
      lines.push('| Spec ID | Date | Commit |')
      lines.push('|---------|------|--------|')
      for (const fix of state.tddAutomation.recentFixes) {
        lines.push(`| \`${fix.specId}\` | ${fix.date} | \`${fix.commitHash}\` |`)
      }
      lines.push('')
      lines.push('</details>')
      lines.push('')
    }
  }

  // ==========================================================================
  // ISSUES REQUIRING ATTENTION
  // ==========================================================================
  if (state.duplicateSpecIds.length > 0 || state.coverageGaps.length > 0 || allIssues.length > 0) {
    lines.push('## ⚡ Issues Requiring Attention')
    lines.push('')

    // Duplicate Spec IDs
    if (state.duplicateSpecIds.length > 0) {
      lines.push('### ❌ Duplicate Spec IDs')
      lines.push('')
      lines.push('> **CRITICAL**: Each spec ID must be unique. Duplicates break TDD queue.')
      lines.push('')

      for (const dup of state.duplicateSpecIds) {
        lines.push(`**\`${dup.specId}\`** (${dup.locations.length} occurrences)`)
        for (const loc of dup.locations) {
          lines.push(`- \`${loc.file}:${loc.line}\``)
        }
        lines.push('')
      }
    }

    // Quality Issues
    if (allIssues.length > 0) {
      const suggestions = allIssues.filter((i) => i.type === 'suggestion')

      if (errors.length > 0) {
        lines.push('### ❌ Errors')
        lines.push('')
        for (const issue of errors) {
          const location = issue.line ? `:${issue.line}` : ''
          lines.push(`- **${issue.code}** in \`${issue.file}${location}\``)
          lines.push(`  ${issue.message}`)
        }
        lines.push('')
      }

      if (warnings.length > 0) {
        lines.push('### ⚠️ Warnings')
        lines.push('')
        for (const issue of warnings) {
          const location = issue.line ? `:${issue.line}` : ''
          lines.push(`- **${issue.code}** in \`${issue.file}${location}\``)
          lines.push(`  ${issue.message}`)
        }
        lines.push('')
      }

      if (suggestions.length > 0) {
        lines.push('<details>')
        lines.push('<summary>💡 Suggestions</summary>')
        lines.push('')
        for (const issue of suggestions) {
          lines.push(`- **${issue.code}** in \`${issue.file}\` - ${issue.message}`)
        }
        lines.push('')
        lines.push('</details>')
        lines.push('')
      }
    }

    // Coverage Gaps
    if (state.coverageGaps.length > 0) {
      lines.push('### 📉 Coverage Gaps')
      lines.push('')
      for (const gap of state.coverageGaps) {
        lines.push(`**${gap.feature}** - Missing:`)
        for (const behavior of gap.missingBehaviors) {
          lines.push(`- [ ] ${behavior}`)
        }
        lines.push('')
      }
    }
  }

  // ==========================================================================
  // FEATURE BREAKDOWN (with domain rollups)
  // ==========================================================================
  lines.push('## 📁 Feature Breakdown')
  lines.push('')

  for (const domain of domainSummaries) {
    const domainProgressFilled = Math.round(domain.progressPercent / 5)
    const domainProgressEmpty = 20 - domainProgressFilled
    const statusLabel = getStatusLabel(
      domain.progressPercent,
      domain.files.some((f) => f.issues.length > 0)
    )

    lines.push(`### ${domain.domain}`)
    lines.push('')
    lines.push(
      `${domain.status} **${domain.totalFiles} files** | **${domain.totalTests} tests** | [${'█'.repeat(domainProgressFilled)}${'░'.repeat(domainProgressEmpty)}] ${domain.progressPercent}% | ${statusLabel}`
    )
    lines.push('')

    lines.push('<details>')
    lines.push(
      `<summary>View ${domain.domain} specs (${domain.totalFiles} files, ${domain.passingTests}/${domain.totalTests} passing)</summary>`
    )
    lines.push('')

    for (const file of domain.files) {
      const statusEmoji =
        file.metadata.fixmeTests > 0
          ? '🚧'
          : file.issues.some((i) => i.type === 'error')
            ? '❌'
            : file.issues.some((i) => i.type === 'warning')
              ? '⚠️'
              : '✅'

      const fileProgress =
        file.metadata.totalTests > 0
          ? Math.round((file.metadata.passingTests / file.metadata.totalTests) * 100)
          : 100

      lines.push(`#### ${statusEmoji} ${file.feature} (${fileProgress}%)`)
      lines.push('')
      lines.push(`📁 \`${file.relativePath}\``)
      lines.push('')

      if (file.metadata.describeLabel) {
        lines.push(`**${file.metadata.describeLabel}**`)
        lines.push('')
      }

      // Compact stats with progress
      lines.push(
        `**${file.metadata.passingTests}/${file.metadata.totalTests}** passing | ${file.metadata.fixmeTests} fixme | ${file.metadata.specTests} @spec | ${file.metadata.regressionTests} @regression`
      )
      lines.push('')

      // Test list
      if (file.tests.length > 0) {
        lines.push('<details>')
        lines.push('<summary>Tests</summary>')
        lines.push('')

        for (const test of file.tests) {
          const statusIcon = test.isFixme ? '⏸️' : '✅'
          const tagBadge = test.tag ? `\`${test.tag}\`` : ''
          const gwtStatus = [
            test.hasGiven ? 'G' : '~G~',
            test.hasWhen ? 'W' : '~W~',
            test.hasThen ? 'T' : '~T~',
          ].join('/')

          lines.push(`${statusIcon} **${test.id || 'NO-ID'}** ${tagBadge}`)
          lines.push(`   ${test.name}`)
          lines.push(`   \`${gwtStatus}\` Line ${test.lineNumber}`)
          lines.push('')
        }

        lines.push('</details>')
        lines.push('')
      }
    }

    lines.push('</details>')
    lines.push('')
  }

  // ==========================================================================
  // QUICK REFERENCE
  // ==========================================================================
  lines.push('## 📖 Quick Reference')
  lines.push('')
  lines.push('### Test Structure Template')
  lines.push('')
  lines.push('```typescript')
  lines.push("test('FEATURE-AREA-001: should [expected behavior] when [condition]',")
  lines.push("  { tag: '@spec' },")
  lines.push('  async ({ page, startServerWithSchema }) => {')
  lines.push('    // GIVEN: [initial context/setup]')
  lines.push('    await startServerWithSchema({ ... })')
  lines.push('')
  lines.push('    // WHEN: [action performed]')
  lines.push("    await page.goto('/')")
  lines.push('')
  lines.push('    // THEN: [expected outcome]')
  lines.push('    await expect(page.locator(...)).toBeVisible()')
  lines.push('  }')
  lines.push(')')
  lines.push('```')
  lines.push('')
  lines.push('### Spec ID Format')
  lines.push('')
  lines.push('| Prefix | Area |')
  lines.push('|--------|------|')
  lines.push('| `APP-` | Application schema specs |')
  lines.push('| `API-` | API endpoint specs |')
  lines.push('| `STATIC-` | Static generation specs |')
  lines.push('| `MIGRATION-` | Migration specs |')
  lines.push('')
  lines.push('### Commands')
  lines.push('')
  lines.push('```bash')
  lines.push('# Regenerate this file')
  lines.push('bun run analyze:specs')
  lines.push('')
  lines.push('# Run all specs')
  lines.push('bun test:e2e:spec')
  lines.push('')
  lines.push('# Run regression tests')
  lines.push('bun test:e2e:regression')
  lines.push('')
  lines.push('# Verify progress against GitHub')
  lines.push('bun run analyze:specs --verify-progress')
  lines.push('```')
  lines.push('')

  return lines.join('\n')
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2)
  const filterPattern = args.find((a) => a.startsWith('--filter='))?.replace('--filter=', '')
  const showFixmeOnly = args.includes('--fixme')
  const noErrorExit = args.includes('--no-error') || !!filterPattern
  const verifyProgress = args.includes('--verify-progress')

  console.log('🔍 Analyzing spec files...')
  console.log('')

  // Find all spec files
  let specFiles = await findSpecFiles(SPECS_DIR)

  if (filterPattern) {
    // Escape special regex characters to prevent ReDoS attacks (CWE-400/CWE-730)
    const escapedPattern = filterPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escapedPattern)
    specFiles = specFiles.filter((f) => regex.test(f))
    console.log(`📁 Filtered to ${specFiles.length} files matching: ${filterPattern}`)
  } else {
    console.log(`📁 Found ${specFiles.length} spec files`)
  }

  // Analyze each file
  const analyzedFiles: SpecFile[] = []

  for (const filePath of specFiles) {
    const file = await analyzeFile(filePath)
    analyzedFiles.push(file)
  }

  // Calculate summary
  const totalTests = analyzedFiles.reduce((sum, f) => sum + f.metadata.totalTests, 0)
  const totalSpecs = analyzedFiles.reduce((sum, f) => sum + f.metadata.specTests, 0)
  const totalRegressions = analyzedFiles.reduce((sum, f) => sum + f.metadata.regressionTests, 0)
  const totalFixme = analyzedFiles.reduce((sum, f) => sum + f.metadata.fixmeTests, 0)
  const totalPassing = analyzedFiles.reduce((sum, f) => sum + f.metadata.passingTests, 0)

  const qualityScore = calculateQualityScore(analyzedFiles)
  const coverageGaps = detectCoverageGaps(analyzedFiles)
  const duplicateSpecIds = detectDuplicateSpecIds(analyzedFiles)
  const tddAutomation = await calculateTDDAutomationStats(totalFixme)

  // Add duplicate spec ID errors to the respective files
  for (const dup of duplicateSpecIds) {
    for (const loc of dup.locations) {
      const file = analyzedFiles.find((f) => f.relativePath === loc.file)
      if (file) {
        file.issues.push({
          type: 'error',
          code: 'DUPLICATE_SPEC_ID',
          message: `Spec ID "${dup.specId}" is duplicated (also in: ${
            dup.locations
              .filter((l) => l.file !== loc.file)
              .map((l) => l.file)
              .join(', ') || 'same file'
          })`,
          line: loc.line,
          testId: dup.specId,
        })
      }
    }
  }

  // Recalculate error counts after adding duplicate errors
  const allIssuesWithDuplicates = analyzedFiles.flatMap((f) => f.issues)
  const errorsWithDuplicates = allIssuesWithDuplicates.filter((i) => i.type === 'error').length
  const warningsWithDuplicates = allIssuesWithDuplicates.filter((i) => i.type === 'warning').length
  const suggestionsWithDuplicates = allIssuesWithDuplicates.filter(
    (i) => i.type === 'suggestion'
  ).length

  const state: SpecState = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalFiles: analyzedFiles.length,
      totalTests,
      totalSpecs,
      totalRegressions,
      totalFixme,
      totalPassing,
      qualityScore,
      duplicateSpecIds: duplicateSpecIds.length,
      issuesByType: {
        errors: errorsWithDuplicates,
        warnings: warningsWithDuplicates,
        suggestions: suggestionsWithDuplicates,
      },
    },
    files: analyzedFiles,
    coverageGaps,
    duplicateSpecIds,
    tddAutomation,
  }

  // Generate markdown
  const markdown = generateMarkdown(state)

  // Format with Prettier and write output
  const prettierConfig = await prettier.resolveConfig(OUTPUT_FILE)
  const formattedMarkdown = await prettier.format(markdown, {
    ...prettierConfig,
    parser: 'markdown',
  })
  await writeFile(OUTPUT_FILE, formattedMarkdown)

  // Migration: Delete old SPEC-STATE.md if it exists
  try {
    await access(OLD_OUTPUT_FILE)
    await unlink(OLD_OUTPUT_FILE)
    console.log(`🗑️  Deleted old file: SPEC-STATE.md (migrated to SPEC-PROGRESS.md)`)
  } catch {
    // File doesn't exist, no migration needed
  }

  // Update README badges with current progress
  const progressPercent = Math.round((totalPassing / Math.max(totalTests, 1)) * 100)
  const readmeContent = await readFile(README_FILE, 'utf-8')

  // URL-encode the badge values
  const specsBadge = `specs-${progressPercent}%25%20(${totalPassing}%2F${totalTests})-blue`
  const qualityBadge = `quality-${qualityScore}%25-brightgreen`
  const progressBadge = `progress-${progressPercent}%25-blue`

  // Update badges using regex - handles multiple formats
  const updatedReadme = readmeContent
    // Handle HTML img tag format: <img src="https://img.shields.io/badge/progress-XX%25-blue"
    .replace(
      /<img src="https:\/\/img\.shields\.io\/badge\/progress-\d+%25-blue"/,
      `<img src="https://img.shields.io/badge/${progressBadge}"`
    )
    // Handle markdown angle-bracket format: [![text](<url>)]
    .replace(
      /\[!\[Spec Progress\]\(<https:\/\/img\.shields\.io\/badge\/specs-[^>]+>\)\]/,
      `[![Spec Progress](<https://img.shields.io/badge/${specsBadge}>)]`
    )
    // Handle markdown regular format: [![text](url)]
    .replace(
      /\[!\[Spec Progress\]\(https:\/\/img\.shields\.io\/badge\/specs-[^)]+\)\]/,
      `[![Spec Progress](<https://img.shields.io/badge/${specsBadge}>)]`
    )
    .replace(
      /\[!\[Quality Score\]\(<https:\/\/img\.shields\.io\/badge\/quality-[^>]+>\)\]/,
      `[![Quality Score](https://img.shields.io/badge/${qualityBadge})]`
    )
    .replace(
      /\[!\[Quality Score\]\(https:\/\/img\.shields\.io\/badge\/quality-[^)]+\)\]/,
      `[![Quality Score](https://img.shields.io/badge/${qualityBadge})]`
    )
    // Migration: Update SPEC-STATE.md links to SPEC-PROGRESS.md
    .replace(/SPEC-STATE\.md/g, 'SPEC-PROGRESS.md')

  if (updatedReadme !== readmeContent) {
    const formattedReadme = await prettier.format(updatedReadme, {
      ...prettierConfig,
      parser: 'markdown',
    })
    await writeFile(README_FILE, formattedReadme)
    console.log(`✅ Updated: ${README_FILE}`)
  }

  // Console output
  console.log('')
  console.log('━'.repeat(60))
  console.log('📊 SPEC QUALITY REPORT')
  console.log('━'.repeat(60))
  console.log('')
  console.log(`Quality Score: ${qualityScore}%`)
  console.log('')
  console.log(`Tests:       ${totalTests} total`)
  console.log(`  ├─ @spec:       ${totalSpecs}`)
  console.log(`  ├─ @regression: ${totalRegressions}`)
  console.log(`  ├─ Passing:     ${totalPassing}`)
  console.log(`  └─ Fixme:       ${totalFixme}`)
  console.log('')
  console.log(`Issues:      ${allIssuesWithDuplicates.length} total`)
  console.log(`  ├─ Errors:      ${errorsWithDuplicates}`)
  console.log(`  ├─ Warnings:    ${warningsWithDuplicates}`)
  console.log(`  └─ Suggestions: ${suggestionsWithDuplicates}`)
  console.log('')

  // TDD Automation stats
  if (tddAutomation.totalFixed > 0 || totalFixme > 0) {
    console.log('🤖 TDD Automation:')
    console.log(`  ├─ Fixed (90d):  ${tddAutomation.totalFixed}`)
    console.log(`  ├─ Last 24h:     ${tddAutomation.fixedLast24h}`)
    console.log(`  ├─ Last 7d:      ${tddAutomation.fixedLast7d}`)
    console.log(`  ├─ Avg/Day:      ${tddAutomation.avgFixesPerDay}`)
    console.log(`  └─ Remaining:    ${totalFixme}`)
    if (tddAutomation.estimatedDaysRemaining !== null) {
      const days = tddAutomation.estimatedDaysRemaining
      const etaText =
        days === 0
          ? 'Less than 1 day'
          : days === 1
            ? '~1 day'
            : days < 7
              ? `~${days} days`
              : days < 30
                ? `~${Math.ceil(days / 7)} weeks`
                : `~${Math.ceil(days / 30)} months`
      console.log('')
      console.log(`⏱️  ETA: ${etaText} (${tddAutomation.estimatedCompletionDate})`)
    }
    console.log('')
  }

  if (duplicateSpecIds.length > 0) {
    console.log('❌ DUPLICATE SPEC IDs:')
    for (const dup of duplicateSpecIds) {
      console.log(`   ${dup.specId} (${dup.locations.length} occurrences):`)
      for (const loc of dup.locations) {
        console.log(`     - ${loc.file}:${loc.line}`)
      }
    }
    console.log('')
  }

  if (errorsWithDuplicates > 0) {
    console.log('❌ ERRORS:')
    for (const file of analyzedFiles) {
      for (const issue of file.issues.filter((i) => i.type === 'error')) {
        console.log(`   ${file.relativePath}:${issue.line || '?'} - ${issue.code}`)
        console.log(`     ${issue.message}`)
      }
    }
    console.log('')
  }

  console.log('━'.repeat(60))
  console.log(`✅ Generated: ${OUTPUT_FILE}`)
  console.log('━'.repeat(60))

  // Show fixme tests for prioritization
  if (showFixmeOnly) {
    console.log('')
    console.log('📋 FIXME TESTS (Next to implement):')
    console.log('')
    for (const file of analyzedFiles) {
      const fixmeTests = file.tests.filter((t) => t.isFixme)
      if (fixmeTests.length > 0) {
        console.log(`📁 ${file.relativePath}`)
        for (const test of fixmeTests) {
          console.log(`   ${test.id || 'NO-ID'}: ${test.name.substring(0, 60)}...`)
        }
        console.log('')
      }
    }
  }

  // Verify progress against GitHub PRs/issues and commits
  if (verifyProgress) {
    console.log('')
    console.log('━'.repeat(60))
    console.log('🔍 PROGRESS VERIFICATION (GitHub Cross-Reference)')
    console.log('━'.repeat(60))
    console.log('')

    // Collect fixme and passing spec IDs from analyzed files
    const fixmeSpecIds = new Set<string>()
    const passingSpecIds = new Set<string>()

    for (const file of analyzedFiles) {
      for (const test of file.tests) {
        if (test.id) {
          if (test.isFixme) {
            fixmeSpecIds.add(test.id)
          } else {
            passingSpecIds.add(test.id)
          }
        }
      }
    }

    console.log(`📊 Codebase Status:`)
    console.log(`   ├─ Fixme spec IDs:   ${fixmeSpecIds.size}`)
    console.log(`   └─ Passing spec IDs: ${passingSpecIds.size}`)
    console.log('')

    console.log('🔄 Fetching GitHub references...')
    const verification = await verifyProgressFromGitHub(fixmeSpecIds, passingSpecIds)

    // Group references by type
    const prRefs = verification.allReferences.filter((r) => r.type === 'pr')
    const issueRefs = verification.allReferences.filter((r) => r.type === 'issue')
    const commitRefs = verification.allReferences.filter((r) => r.type === 'commit')

    // Deduplicate spec IDs across all sources
    const uniqueSpecIdsFromPRs = new Set(prRefs.map((r) => r.specId))
    const uniqueSpecIdsFromIssues = new Set(issueRefs.map((r) => r.specId))
    const uniqueSpecIdsFromCommits = new Set(commitRefs.map((r) => r.specId))

    console.log('')
    console.log(`📦 GitHub References Found:`)
    console.log(
      `   ├─ Merged PRs:        ${prRefs.length} (${uniqueSpecIdsFromPRs.size} unique spec IDs)`
    )
    console.log(
      `   ├─ Closed Issues:     ${issueRefs.length} (${uniqueSpecIdsFromIssues.size} unique spec IDs)`
    )
    console.log(
      `   └─ Commits:           ${commitRefs.length} (${uniqueSpecIdsFromCommits.size} unique spec IDs)`
    )
    console.log('')
    console.log(`   Total unique spec IDs tracked: ${verification.fixedSpecIds.size}`)
    console.log('')

    // Show discrepancies
    if (verification.discrepancies.length > 0) {
      console.log('⚠️  DISCREPANCIES DETECTED:')
      console.log('')
      for (const disc of verification.discrepancies) {
        console.log(`   ❌ ${disc.specId} (${disc.status})`)
        console.log(`      ${disc.suggestion}`)
        console.log(`      References:`)
        for (const ref of disc.references.slice(0, 3)) {
          switch (ref.type) {
            case 'pr':
              console.log(`        - PR #${ref.number}: ${ref.title.substring(0, 60)}...`)
              break
            case 'issue':
              console.log(`        - Issue #${ref.number}: ${ref.title.substring(0, 60)}...`)
              break
            case 'commit':
              console.log(`        - Commit ${ref.hash}: ${ref.title.substring(0, 60)}...`)
              break
          }
        }
        if (disc.references.length > 3) {
          console.log(`        ... and ${disc.references.length - 3} more references`)
        }
        console.log('')
      }

      console.log('━'.repeat(60))
      console.log(`❌ Found ${verification.discrepancies.length} discrepancies`)
      console.log(
        '   These specs appear to be fixed in PRs/commits but are still marked as .fixme()'
      )
      console.log(
        '   Action: Remove .fixme() from these tests or investigate why they are still failing'
      )
      console.log('━'.repeat(60))
    } else {
      console.log('✅ No discrepancies found - all fixed specs are correctly tracked!')
    }
    console.log('')

    // Show recent fixes from GitHub for comparison
    const recentPRs = prRefs.slice(0, 10)
    if (recentPRs.length > 0) {
      console.log('📋 Recent Merged PRs with Spec IDs (last 10):')
      for (const pr of recentPRs) {
        const dateStr = new Date(pr.date).toISOString().substring(0, 16).replace('T', ' ')
        console.log(`   PR #${pr.number} | ${dateStr} | ${pr.specId}`)
      }
      console.log('')
    }
  }

  // Exit with error code if there are errors (including duplicates) (unless --no-error or --filter is used)
  if (errorsWithDuplicates > 0 && !noErrorExit) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
