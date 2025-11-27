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

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, basename } from 'node:path'

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
const OUTPUT_FILE = join(process.cwd(), 'SPEC-STATE.md')

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

    // Check for GIVEN/WHEN/THEN structure
    if (test.tag === '@spec') {
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

  // Check for sequential spec IDs
  const specIds = specTests.map((t) => t.id).filter(Boolean) as string[]
  if (specIds.length > 1) {
    const idNumbers = specIds.map((id) => {
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
          message: `Spec IDs are not sequential (gap between ${specIds[i - 1]} and ${specIds[i]})`,
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

// =============================================================================
// Output Generation
// =============================================================================

function generateMarkdown(state: SpecState): string {
  const lines: string[] = []

  // Header
  lines.push('# SPEC STATE')
  lines.push('')
  lines.push(`> Generated: ${state.generatedAt}`)
  lines.push('>')
  lines.push('> This file is auto-generated by `bun run scripts/analyze-specs.ts`')
  lines.push('> Use it to review, iterate, and track test coverage.')
  lines.push('')

  // Summary
  lines.push('## Summary')
  lines.push('')
  lines.push(`| Metric | Value |`)
  lines.push(`|--------|-------|`)
  lines.push(`| **Quality Score** | ${state.summary.qualityScore}% |`)
  lines.push(`| Total Files | ${state.summary.totalFiles} |`)
  lines.push(`| Total Tests | ${state.summary.totalTests} |`)
  lines.push(`| @spec Tests | ${state.summary.totalSpecs} |`)
  lines.push(`| @regression Tests | ${state.summary.totalRegressions} |`)
  lines.push(`| Passing | ${state.summary.totalPassing} |`)
  lines.push(`| Fixme | ${state.summary.totalFixme} |`)
  lines.push(`| Errors | ${state.summary.issuesByType.errors} |`)
  lines.push(`| Warnings | ${state.summary.issuesByType.warnings} |`)
  lines.push(`| Suggestions | ${state.summary.issuesByType.suggestions} |`)
  lines.push(`| Duplicate Spec IDs | ${state.summary.duplicateSpecIds} |`)
  lines.push('')

  // Progress bar
  const progressPercent = Math.round(
    (state.summary.totalPassing / Math.max(state.summary.totalTests, 1)) * 100
  )
  const progressFilled = Math.round(progressPercent / 5)
  const progressEmpty = 20 - progressFilled
  lines.push(
    `**Progress:** [${'█'.repeat(progressFilled)}${'░'.repeat(progressEmpty)}] ${progressPercent}% (${state.summary.totalPassing}/${state.summary.totalTests})`
  )
  lines.push('')

  // Coverage Gaps
  if (state.coverageGaps.length > 0) {
    lines.push('## Coverage Gaps')
    lines.push('')
    for (const gap of state.coverageGaps) {
      lines.push(`### ${gap.feature}`)
      lines.push('')
      lines.push('Missing behaviors:')
      for (const behavior of gap.missingBehaviors) {
        lines.push(`- [ ] ${behavior}`)
      }
      lines.push('')
      lines.push(`> 💡 ${gap.suggestion}`)
      lines.push('')
    }
  }

  // Duplicate Spec IDs
  if (state.duplicateSpecIds.length > 0) {
    lines.push('## ❌ Duplicate Spec IDs')
    lines.push('')
    lines.push('> **CRITICAL**: Each spec ID must be unique across the entire test suite.')
    lines.push('> Duplicate IDs will cause issues in the TDD automation queue.')
    lines.push('')

    for (const dup of state.duplicateSpecIds) {
      lines.push(`### \`${dup.specId}\` (${dup.locations.length} occurrences)`)
      lines.push('')
      for (const loc of dup.locations) {
        lines.push(`- \`${loc.file}:${loc.line}\``)
        lines.push(`  ${loc.testName.substring(0, 80)}${loc.testName.length > 80 ? '...' : ''}`)
      }
      lines.push('')
    }
  }

  // Quality Issues
  const allIssues = state.files.flatMap((f) =>
    f.issues.map((i) => ({ ...i, file: f.relativePath }))
  )

  if (allIssues.length > 0) {
    lines.push('## Quality Issues')
    lines.push('')

    const errors = allIssues.filter((i) => i.type === 'error')
    const warnings = allIssues.filter((i) => i.type === 'warning')
    const suggestions = allIssues.filter((i) => i.type === 'suggestion')

    if (errors.length > 0) {
      lines.push('### Errors')
      lines.push('')
      for (const issue of errors) {
        const location = issue.line ? `:${issue.line}` : ''
        lines.push(`- **${issue.code}** in \`${issue.file}${location}\``)
        lines.push(`  ${issue.message}`)
        if (issue.testId) {
          lines.push(`  Test: ${issue.testId}`)
        }
      }
      lines.push('')
    }

    if (warnings.length > 0) {
      lines.push('### Warnings')
      lines.push('')
      for (const issue of warnings) {
        const location = issue.line ? `:${issue.line}` : ''
        lines.push(`- **${issue.code}** in \`${issue.file}${location}\``)
        lines.push(`  ${issue.message}`)
      }
      lines.push('')
    }

    if (suggestions.length > 0) {
      lines.push('### Suggestions')
      lines.push('')
      for (const issue of suggestions) {
        lines.push(`- **${issue.code}** in \`${issue.file}\``)
        lines.push(`  ${issue.message}`)
      }
      lines.push('')
    }
  }

  // Specifications by Feature
  lines.push('## Specifications by Feature')
  lines.push('')

  // Group by feature area
  const byArea = new Map<string, SpecFile[]>()
  for (const file of state.files) {
    const area = file.relativePath.split('/')[0] || 'root'
    if (!byArea.has(area)) {
      byArea.set(area, [])
    }
    byArea.get(area)!.push(file)
  }

  for (const [area, areaFiles] of byArea) {
    lines.push(`### ${area.toUpperCase()}`)
    lines.push('')

    for (const file of areaFiles) {
      const statusEmoji =
        file.metadata.fixmeTests > 0
          ? '🚧'
          : file.issues.some((i) => i.type === 'error')
            ? '❌'
            : file.issues.some((i) => i.type === 'warning')
              ? '⚠️'
              : '✅'

      lines.push(`#### ${statusEmoji} ${file.feature}`)
      lines.push('')
      lines.push(`📁 \`${file.relativePath}\``)
      lines.push('')

      if (file.metadata.describeLabel) {
        lines.push(`**${file.metadata.describeLabel}**`)
        lines.push('')
      }

      // Stats
      lines.push(`| Tests | Passing | Fixme | @spec | @regression |`)
      lines.push(`|-------|---------|-------|-------|-------------|`)
      lines.push(
        `| ${file.metadata.totalTests} | ${file.metadata.passingTests} | ${file.metadata.fixmeTests} | ${file.metadata.specTests} | ${file.metadata.regressionTests} |`
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
  }

  // Quick Reference
  lines.push('## Quick Reference')
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
  lines.push('bun run scripts/analyze-specs.ts')
  lines.push('')
  lines.push('# Run all specs')
  lines.push('bun test:e2e:spec')
  lines.push('')
  lines.push('# Run regression tests')
  lines.push('bun test:e2e:regression')
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

  const allIssues = analyzedFiles.flatMap((f) => f.issues)
  const errors = allIssues.filter((i) => i.type === 'error').length
  const warnings = allIssues.filter((i) => i.type === 'warning').length
  const suggestions = allIssues.filter((i) => i.type === 'suggestion').length

  const qualityScore = calculateQualityScore(analyzedFiles)
  const coverageGaps = detectCoverageGaps(analyzedFiles)
  const duplicateSpecIds = detectDuplicateSpecIds(analyzedFiles)

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
      issuesByType: { errors, warnings, suggestions },
    },
    files: analyzedFiles,
    coverageGaps,
    duplicateSpecIds,
  }

  // Generate markdown
  const markdown = generateMarkdown(state)

  // Write output
  await writeFile(OUTPUT_FILE, markdown)

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
  console.log(`Issues:      ${allIssues.length} total`)
  console.log(`  ├─ Errors:      ${errors}`)
  console.log(`  ├─ Warnings:    ${warnings}`)
  console.log(`  └─ Suggestions: ${suggestions}`)
  console.log('')

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

  if (errors > 0) {
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

  // Exit with error code if there are errors or duplicates (unless --no-error or --filter is used)
  if ((errors > 0 || duplicateSpecIds.length > 0) && !noErrorExit) {
    if (duplicateSpecIds.length > 0) {
      console.log('')
      console.log('❌ CRITICAL: Duplicate spec IDs detected!')
      console.log('   Each spec ID must be unique across the test suite.')
      console.log('   Fix duplicates before running TDD automation.')
    }
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
