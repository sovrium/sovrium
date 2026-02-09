/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines -- Self-contained utility script */

/**
 * Content Quality Analyzer (Tier 2)
 *
 * Analyzes E2E test files (.spec.ts) and user story files (.md) for content
 * quality, then generates a SPEC-PROGRESS.md report as the single source of
 * truth for test coverage and specification review.
 *
 * Two-tier architecture:
 * - Tier 1: `bun run quality` — Code quality (format, lint, types, tests, coverage, e2e)
 * - Tier 2: `bun run progress` — Content quality + reporting (this script)
 * - Both:   `bun run check:all` — quality && progress --strict
 *
 * Spec quality checks:
 * - Test naming conventions and descriptiveness
 * - Spec IDs (APP-*, API-*, STATIC-*, etc.)
 * - GIVEN/WHEN/THEN structure in comments
 * - Test organization (@spec vs @regression tags)
 * - Coverage gaps and missing behaviors
 * - Header "Spec Count: X" matches actual @spec count
 *
 * User story quality checks:
 * - H1 title and Feature Area metadata
 * - User story structure (As a / I want to / so that)
 * - Acceptance Criteria table with 4 columns
 * - AC/US ID format validation
 * - Implementation References section
 * - Schema/Spec file references exist on disk
 * - Spec IDs in AC tables match actual spec files
 * - No duplicate US/AC IDs
 *
 * Usage:
 *   bun run scripts/check-progress.ts [options]
 *
 * Options:
 *   --filter=pattern     Filter files by regex pattern
 *   --fixme              Show list of fixme tests for prioritization
 *   --fix                Auto-fix header count mismatches
 *   --no-error           Don't exit with error code on quality issues
 *   --skip-stories       Skip user story validation
 *   --strict             Exit 1 if any quality issues found
 *   --verify-progress    Cross-reference with GitHub PRs/issues
 *   --update-stories     Update user story files with test status
 *
 * Examples:
 *   bun run progress                       # Full content analysis
 *   bun run progress --skip-stories        # Skip user story validation
 *   bun run progress --filter=version      # Analyze only version specs
 *   bun run progress --fixme               # Show fixme tests to implement next
 *   bun run progress --fix                 # Auto-fix header count mismatches
 *   bun run progress --update-stories      # Update user stories with test status
 *   bun run progress --strict              # Fail on any issues
 */

import { readdir, readFile, writeFile, unlink, access } from 'node:fs/promises'
import { join, relative, basename } from 'node:path'
import { JSONSchema } from 'effect'
import { load as parseYaml } from 'js-yaml'
import * as prettier from 'prettier'
import * as apiSchemas from '../src/domain/models/api'
import { AppSchema } from '../src/domain/models/app'

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
    orphanedSpecIds: number
    issuesByType: {
      errors: number
      warnings: number
      suggestions: number
    }
  }
  files: SpecFile[]
  coverageGaps: CoverageGap[]
  duplicateSpecIds: DuplicateSpecId[]
  orphanedSpecIds: OrphanedSpecId[]
  tddAutomation: TDDAutomationStats
  userStoryMetrics: UserStoryMetrics | null
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
  fixedByPipeline: number
  fixedManually: number
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
    source: 'tdd-pipeline' | 'manual'
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
// User Story Tracking Types
// =============================================================================

interface AcceptanceCriterion {
  id: string // e.g., "AC-001"
  criterion: string
  specTestId: string | null // e.g., "API-AUTH-SIGN-UP-EMAIL-001" or null if not linked
  schema: string
  status: 'complete' | 'partial' | 'not-started'
}

interface UserStory {
  id: string // e.g., "US-AUTH-METHOD-DEV-001"
  title: string
  story: string
  status: 'complete' | 'partial' | 'not-started'
  acceptanceCriteria: AcceptanceCriterion[]
  filePath: string
  domain: string
  featureArea: string
  role: string
}

interface UserStoryMetrics {
  totalStories: number
  totalCriteria: number
  // Stories NOT linked to any spec IDs
  storiesToSpecify: UserStory[]
  storiesToSpecifyPercent: number
  // Stories linked to spec IDs with .fixme() status
  storiesSpecifiedNotImplemented: UserStory[]
  storiesSpecifiedNotImplementedPercent: number
  // Stories linked to passing spec IDs
  storiesSpecifiedAndImplemented: UserStory[]
  storiesSpecifiedAndImplementedPercent: number
  // All stories organized by domain
  byDomain: Map<string, UserStory[]>
}

interface OrphanedSpecId {
  specId: string
  file: string
  line: number
  testName: string
}

// =============================================================================
// Constants
// =============================================================================

const SPEC_ID_PATTERN = /^([A-Z]+-[A-Z0-9-]+-(?:\d{3}|REGRESSION))/
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
const USER_STORIES_DIR = join(process.cwd(), 'docs/user-stories')
const SCHEMA_MODEL_DIRS = ['src/domain/models/app', 'src/domain/models/api']
const FILE_HEADER_SCHEMA_PATTERN = /^>\s*\*\*Schema\*\*:\s*(.+)/m

// User Story parsing patterns
const USER_STORY_STATUS_PATTERN = /\*\*Status\*\*:\s*`\[([x~\s])\]`/
// Match spec test IDs in acceptance criteria tables
// Format: | ID | Criterion | E2E Spec | (optional: Status) |
// Example: | AC-001 | User receives 200 OK... | `API-AUTH-SIGN-UP-EMAIL-001` | ✅ |
// Note: The 4th Status column is optional (added by --update-stories flag)
const ACCEPTANCE_CRITERIA_TABLE_ROW_PATTERN =
  /^\|\s*(AC-\d{3})\s*\|\s*([^|]+)\s*\|\s*`?([A-Z]+-[A-Z0-9-]+-(?:\d{3}|REGRESSION))?`?\s*\|(?:\s*[^|]*\s*\|)?$/gm
// Domain/feature/role from file metadata
const DOMAIN_PATTERN = />\s*\*\*Domain\*\*:\s*(\S+)/
const FEATURE_AREA_PATTERN = />\s*\*\*Feature Area\*\*:\s*(\S+)/
const ROLE_PATTERN = />\s*\*\*Role\*\*:\s*(.+)/

// =============================================================================
// User Story Validation Types & Patterns (merged from check-user-stories.ts)
// =============================================================================

interface StoryValidationIssue {
  readonly file: string
  readonly severity: 'error' | 'warning' | 'info'
  readonly message: string
  readonly line?: number
}

interface UserStorySection {
  readonly id: string
  readonly title: string
  readonly lineNumber: number
  readonly hasAsA: boolean
  readonly hasIWantTo: boolean
  readonly hasSoThat: boolean
  readonly hasAcceptanceCriteria: boolean
  readonly hasImplementationReferences: boolean
  readonly acIds: readonly string[]
  readonly specIds: readonly string[]
  readonly schemaRefs: readonly string[]
  readonly specFileRefs: readonly string[]
}

interface UserStoryFileValidation {
  readonly path: string
  readonly relativePath: string
  readonly hasH1: boolean
  readonly hasFeatureArea: boolean
  readonly stories: readonly UserStorySection[]
  readonly issues: readonly StoryValidationIssue[]
  readonly rawContent: string
}

// Patterns for structural validation
const US_HEADING_PATTERN = /^## (US-[\w-]+):\s*(.+)/
const AC_ROW_PATTERN = /^\|\s*(AC-\d+)\s*\|/
const SPEC_ID_IN_AC_PATTERN = /`([\w-]+)`/
const IMPL_SCHEMA_PATTERN = /\*\*Schema\*\*:\s*`([^`]+)`/
const IMPL_SPEC_PATTERN = /\*\*E2E Spec\*\*:\s*`([^`]+)`/
const USER_STORIES_RELATIVE_DIR = 'docs/user-stories'

// =============================================================================
// User Story Validation Functions (merged from check-user-stories.ts)
// =============================================================================

/**
 * Parse a single user story section (between ## US- headings) for structural validation.
 */
function parseStorySection(
  file: string,
  id: string,
  title: string,
  lineNumber: number,
  lines: readonly string[],
  issues: StoryValidationIssue[]
): UserStorySection {
  const content = lines.join('\n')

  // Check US ID format: US-{FEATURE-SEGMENTS}-{NNN}
  if (!/^US-[A-Z][\w-]*-\d+$/.test(id)) {
    issues.push({
      file,
      severity: 'warning',
      message: `US ID "${id}" does not follow US-{FEATURE}-{NNN} pattern`,
      line: lineNumber,
    })
  }

  // Check "As a" / "I want to" / "so that"
  const hasAsA = /\*\*As a\*\*/.test(content)
  const hasIWantTo = /\*\*I want to\*\*/.test(content)
  const hasSoThat = /\*\*so that\*\*/.test(content)

  if (!hasAsA)
    issues.push({
      file,
      severity: 'error',
      message: `${id}: Missing "**As a**" phrase`,
      line: lineNumber,
    })
  if (!hasIWantTo)
    issues.push({
      file,
      severity: 'error',
      message: `${id}: Missing "**I want to**" phrase`,
      line: lineNumber,
    })
  if (!hasSoThat)
    issues.push({
      file,
      severity: 'error',
      message: `${id}: Missing "**so that**" phrase`,
      line: lineNumber,
    })

  // Check Acceptance Criteria
  const hasAcceptanceCriteria = /### Acceptance Criteria/.test(content)
  if (!hasAcceptanceCriteria)
    issues.push({
      file,
      severity: 'error',
      message: `${id}: Missing ### Acceptance Criteria section`,
      line: lineNumber,
    })

  // Parse AC rows
  const acIds: string[] = []
  const specIds: string[] = []
  let inAcTable = false
  let acTableHeaderSeen = false

  for (const line of lines) {
    if (/### Acceptance Criteria/.test(line)) {
      inAcTable = true
      acTableHeaderSeen = false
      continue
    }
    if (inAcTable && /^###?\s/.test(line) && !/### Acceptance Criteria/.test(line)) {
      inAcTable = false
      continue
    }
    if (inAcTable) {
      if (/^\|[\s-|]+\|$/.test(line)) {
        acTableHeaderSeen = true
        continue
      }
      if (!acTableHeaderSeen && /^\|.*ID.*\|/.test(line)) {
        const columns = line.split('|').filter((c) => c.trim().length > 0)
        if (columns.length !== 4)
          issues.push({
            file,
            severity: 'warning',
            message: `${id}: AC table header has ${columns.length} columns, expected 4`,
          })
        continue
      }
      const acMatch = AC_ROW_PATTERN.exec(line)
      if (acMatch?.[1]) {
        acIds.push(acMatch[1])
        const specColumn = line.split('|')[3] ?? ''
        const specMatch = SPEC_ID_IN_AC_PATTERN.exec(specColumn)
        if (specMatch?.[1]) specIds.push(specMatch[1])
      }
    }
  }

  // Check for empty AC table
  if (hasAcceptanceCriteria && acIds.length === 0)
    issues.push({ file, severity: 'warning', message: `${id}: Acceptance Criteria table is empty` })

  // Duplicate AC IDs
  const seenAcIds = new Set<string>()
  for (const acId of acIds) {
    if (seenAcIds.has(acId))
      issues.push({ file, severity: 'error', message: `${id}: Duplicate AC ID: ${acId}` })
    seenAcIds.add(acId)
  }

  // Check Implementation References
  const hasImplementationReferences = /### Implementation References/.test(content)
  if (!hasImplementationReferences)
    issues.push({
      file,
      severity: 'warning',
      message: `${id}: Missing ### Implementation References section`,
      line: lineNumber,
    })

  // Extract schema and spec file references
  const schemaRefs: string[] = []
  const specFileRefs: string[] = []
  let inImplRefs = false
  for (const line of lines) {
    if (/### Implementation References/.test(line)) {
      inImplRefs = true
      continue
    }
    if (inImplRefs && /^###?\s/.test(line)) {
      inImplRefs = false
      continue
    }
    if (inImplRefs) {
      const schemaMatch = IMPL_SCHEMA_PATTERN.exec(line)
      if (schemaMatch?.[1]) schemaRefs.push(schemaMatch[1])
      const specFileMatch = IMPL_SPEC_PATTERN.exec(line)
      if (specFileMatch?.[1]) specFileRefs.push(specFileMatch[1])
    }
  }

  return {
    id,
    title,
    lineNumber,
    hasAsA,
    hasIWantTo,
    hasSoThat,
    hasAcceptanceCriteria,
    hasImplementationReferences,
    acIds,
    specIds,
    schemaRefs,
    specFileRefs,
  }
}

/**
 * Parse a user story markdown file for structural validation.
 */
function parseUserStoryFileForValidation(
  relativePath: string,
  content: string
): UserStoryFileValidation {
  const lines = content.split('\n')
  const issues: StoryValidationIssue[] = []

  const hasH1 = lines.some((line) => /^# .+/.test(line))
  if (!hasH1) issues.push({ file: relativePath, severity: 'error', message: 'Missing H1 title' })

  const hasFeatureArea = lines.some((line) => />\s*\*\*Feature Area\*\*:/.test(line))
  if (!hasFeatureArea)
    issues.push({ file: relativePath, severity: 'error', message: 'Missing Feature Area metadata' })

  const stories: UserStorySection[] = []
  let currentStoryStart = -1
  let currentStoryId = ''
  let currentStoryTitle = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const match = US_HEADING_PATTERN.exec(line)
    if (match) {
      if (currentStoryStart >= 0) {
        const storyContent = lines.slice(currentStoryStart, i)
        stories.push(
          parseStorySection(
            relativePath,
            currentStoryId,
            currentStoryTitle,
            currentStoryStart + 1,
            storyContent,
            issues
          )
        )
      }
      currentStoryStart = i
      currentStoryId = match[1] ?? ''
      currentStoryTitle = match[2] ?? ''
    }
  }
  if (currentStoryStart >= 0) {
    stories.push(
      parseStorySection(
        relativePath,
        currentStoryId,
        currentStoryTitle,
        currentStoryStart + 1,
        lines.slice(currentStoryStart),
        issues
      )
    )
  }

  if (stories.length === 0)
    issues.push({ file: relativePath, severity: 'error', message: 'No user story sections found' })

  // Check duplicate US IDs
  const seenUsIds = new Set<string>()
  for (const s of stories) {
    if (seenUsIds.has(s.id))
      issues.push({
        file: relativePath,
        severity: 'error',
        message: `Duplicate user story ID: ${s.id}`,
      })
    seenUsIds.add(s.id)
  }

  return {
    path: `${USER_STORIES_RELATIVE_DIR}/${relativePath}`,
    relativePath,
    hasH1,
    hasFeatureArea,
    stories,
    issues,
    rawContent: content,
  }
}

/**
 * Validate that file references in user stories actually exist on disk.
 */
async function validateFileReferences(
  files: readonly UserStoryFileValidation[]
): Promise<StoryValidationIssue[]> {
  const issues: StoryValidationIssue[] = []
  for (const file of files) {
    for (const story of file.stories) {
      for (const schemaRef of story.schemaRefs) {
        try {
          await access(schemaRef)
        } catch {
          try {
            await access(schemaRef.replace(/\/$/, ''))
          } catch {
            issues.push({
              file: file.relativePath,
              severity: 'warning',
              message: `${story.id}: Schema path does not exist: ${schemaRef}`,
            })
          }
        }
      }
      for (const specRef of story.specFileRefs) {
        try {
          await access(specRef)
        } catch {
          try {
            await access(specRef.replace(/\/$/, ''))
          } catch {
            issues.push({
              file: file.relativePath,
              severity: 'warning',
              message: `${story.id}: E2E Spec path does not exist: ${specRef}`,
            })
          }
        }
      }
    }
  }
  return issues
}

/**
 * Validate that spec IDs referenced in AC tables actually exist in spec files.
 * Reuses the allSpecIds set already collected from spec file analysis.
 */
function validateSpecIdReferences(
  files: readonly UserStoryFileValidation[],
  allSpecIds: Set<string>
): StoryValidationIssue[] {
  const issues: StoryValidationIssue[] = []
  for (const file of files) {
    for (const story of file.stories) {
      for (const specId of story.specIds) {
        if (!allSpecIds.has(specId)) {
          issues.push({
            file: file.relativePath,
            severity: 'warning',
            message: `${story.id}: Spec ID "${specId}" not found in any spec file`,
          })
        }
      }
    }
  }
  return issues
}

// =============================================================================
// Schema Coherence Validation (YAML config + JSON API responses)
// =============================================================================

/**
 * Generate JSON Schema from AppSchema at runtime.
 * Uses the same approach as scripts/export-schema.ts.
 */
function generateAppJsonSchema(): object {
  return JSONSchema.make(AppSchema) as object
}

/**
 * Recursively extract all valid dot-paths from a JSON Schema object.
 * Handles $ref, anyOf/oneOf (union types), properties, and Record types
 * (patternProperties/additionalProperties).
 *
 * Returns { paths, recordPaths } where:
 * - paths: Set of all explicitly named dot-paths
 * - recordPaths: Set of paths that accept arbitrary sub-keys (Record types)
 */
function extractValidPaths(
  schema: Record<string, unknown>,
  defs?: Record<string, unknown>,
  prefix?: string
): { paths: Set<string>; recordPaths: Set<string> } {
  const paths = new Set<string>()
  const recordPaths = new Set<string>()
  const resolvedDefs = defs ?? (schema['$defs'] as Record<string, unknown> | undefined)

  // Resolve $ref
  const resolve = (node: Record<string, unknown>): Record<string, unknown> => {
    const ref = node['$ref'] as string | undefined
    if (ref && resolvedDefs) {
      const defKey = ref.replace(/^#\/\$defs\//, '')
      return (resolvedDefs[defKey] as Record<string, unknown>) ?? node
    }
    return node
  }

  const walk = (node: Record<string, unknown>, currentPrefix: string) => {
    const resolved = resolve(node)

    // Handle properties directly
    const props = resolved['properties'] as Record<string, unknown> | undefined
    if (props) {
      for (const key of Object.keys(props)) {
        const fullPath = currentPrefix ? `${currentPrefix}.${key}` : key
        paths.add(fullPath)
        walk(props[key] as Record<string, unknown>, fullPath)
      }
    }

    // Detect Record types: patternProperties or object additionalProperties with no named props.
    // These accept any sub-key (e.g., theme.colors, theme.spacing, theme.shadows).
    const hasPatternProps = resolved['patternProperties'] !== undefined
    const hasObjectAdditionalProps =
      resolved['additionalProperties'] !== undefined &&
      typeof resolved['additionalProperties'] === 'object'
    const hasNoNamedProps = !props || Object.keys(props).length === 0

    if ((hasPatternProps || hasObjectAdditionalProps) && hasNoNamedProps && currentPrefix) {
      recordPaths.add(currentPrefix)
    }

    // Handle anyOf / oneOf (union types like boolean | object)
    const branches =
      (resolved['anyOf'] as Array<Record<string, unknown>> | undefined) ??
      (resolved['oneOf'] as Array<Record<string, unknown>> | undefined)
    if (branches) {
      for (const branch of branches) {
        walk(resolve(branch), currentPrefix)
      }
    }
  }

  walk(schema, prefix ?? '')
  return { paths, recordPaths }
}

/**
 * Extract fenced YAML code blocks from markdown content.
 * Returns array of { yaml, lineNumber }.
 */
function extractYamlConfigBlocks(content: string): Array<{ yaml: string; lineNumber: number }> {
  const blocks: Array<{ yaml: string; lineNumber: number }> = []
  const lines = content.split('\n')
  let inBlock = false
  let blockLines: string[] = []
  let blockStart = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (!inBlock && line.trim() === '```yaml') {
      inBlock = true
      blockLines = []
      blockStart = i + 2 // 1-indexed, next line
    } else if (inBlock && line.trim() === '```') {
      inBlock = false
      blocks.push({ yaml: blockLines.join('\n'), lineNumber: blockStart })
    } else if (inBlock) {
      blockLines.push(line)
    }
  }

  return blocks
}

/**
 * Recursively extract dot-paths from a plain JS object.
 */
function extractDotPaths(obj: unknown, prefix?: string): string[] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return []
  const paths: string[] = []
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const fullPath = prefix ? `${prefix}.${key}` : key
    paths.push(fullPath)
    paths.push(...extractDotPaths((obj as Record<string, unknown>)[key], fullPath))
  }
  return paths
}

/**
 * Find the most similar valid key for "did you mean?" suggestions.
 */
function findSimilarKey(invalidPath: string, validPaths: readonly string[]): string | null {
  const parts = invalidPath.split('.')
  const lastPart = parts[parts.length - 1] ?? ''
  const parentPath = parts.slice(0, -1).join('.')

  // Check sibling keys (same parent)
  const siblings = validPaths.filter((p) => {
    const pParts = p.split('.')
    return pParts.slice(0, -1).join('.') === parentPath
  })

  for (const sibling of siblings) {
    const siblingLast = sibling.split('.').pop() ?? ''
    if (
      (lastPart && siblingLast.toLowerCase().includes(lastPart.toLowerCase())) ||
      (lastPart && lastPart.toLowerCase().includes(siblingLast.toLowerCase()))
    ) {
      return sibling
    }
  }

  return null
}

/**
 * Validate YAML config blocks in user story files against the AppSchema.
 */
function validateYamlConfigCoherence(
  files: readonly UserStoryFileValidation[],
  validPaths: Set<string>,
  recordPaths: Set<string>,
  topLevelKeys: Set<string>
): StoryValidationIssue[] {
  const issues: StoryValidationIssue[] = []
  const validPathsArray = [...validPaths]

  // Check if a path falls under a Record-typed ancestor (any sub-key is valid)
  const isUnderRecordPath = (docPath: string): boolean => {
    for (const rp of recordPaths) {
      if (docPath.startsWith(rp + '.')) return true
    }
    return false
  }

  for (const file of files) {
    const content = file.rawContent
    if (!content) continue

    const yamlBlocks = extractYamlConfigBlocks(content)

    for (const block of yamlBlocks) {
      let parsed: unknown
      try {
        parsed = parseYaml(block.yaml)
      } catch {
        // Unparseable YAML — skip silently (could be pseudo-code)
        continue
      }

      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) continue

      const rootKeys = Object.keys(parsed as Record<string, unknown>)
      // Only validate blocks whose root keys are AppSchema top-level keys
      const isAppConfig = rootKeys.some((k) => topLevelKeys.has(k))
      if (!isAppConfig) continue

      const docPaths = extractDotPaths(parsed)
      for (const docPath of docPaths) {
        if (!validPaths.has(docPath) && !isUnderRecordPath(docPath)) {
          const hint = findSimilarKey(docPath, validPathsArray)
          const hintText = hint ? ` (did you mean "${hint}"?)` : ''
          issues.push({
            file: file.relativePath,
            severity: 'warning',
            message: `YAML config path "${docPath}" does not exist in AppSchema${hintText}`,
            line: block.lineNumber,
          })
        }
      }
    }
  }

  return issues
}

/**
 * Extract fenced JSON code blocks from markdown content.
 * Skips blocks that look like HTTP requests.
 */
function extractJsonResponseBlocks(content: string): Array<{ json: string; lineNumber: number }> {
  const blocks: Array<{ json: string; lineNumber: number }> = []
  const lines = content.split('\n')
  let inBlock = false
  let blockLines: string[] = []
  let blockStart = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (!inBlock && line.trim() === '```json') {
      inBlock = true
      blockLines = []
      blockStart = i + 2
    } else if (inBlock && line.trim() === '```') {
      inBlock = false
      const text = blockLines.join('\n').trim()
      // Skip HTTP request blocks
      if (!/^(POST|GET|PUT|PATCH|DELETE|HEAD|OPTIONS)\s/i.test(text)) {
        blocks.push({ json: text, lineNumber: blockStart })
      }
    } else if (inBlock) {
      blockLines.push(line)
    }
  }

  return blocks
}

/**
 * Build a registry of Zod response schemas from the API schemas barrel export.
 * Only includes exports that look like Zod schema objects (have .safeParse method).
 */
function buildApiSchemaRegistry(): Map<string, { schema: unknown; keys: Set<string> }> {
  const registry = new Map<string, { schema: unknown; keys: Set<string> }>()

  for (const [name, value] of Object.entries(apiSchemas)) {
    // Only include exports that look like Zod schemas
    const v = value as unknown as Record<string, unknown>
    if (
      v &&
      typeof v === 'object' &&
      'safeParse' in v &&
      typeof v.safeParse === 'function' &&
      name.endsWith('Schema')
    ) {
      // Extract top-level keys from Zod schema shape
      const shape = v.shape as Record<string, unknown> | undefined
      if (shape) {
        registry.set(name, {
          schema: v,
          keys: new Set(Object.keys(shape)),
        })
      }
    }
  }

  return registry
}

/**
 * Find the best matching API schema for a JSON object using Jaccard similarity on keys.
 */
function findMatchingApiSchema(
  jsonObj: Record<string, unknown>,
  registry: Map<string, { schema: unknown; keys: Set<string> }>
): { name: string; schema: unknown } | null {
  const objKeys = new Set(Object.keys(jsonObj))
  if (objKeys.size === 0) return null

  let bestMatch: { name: string; schema: unknown } | null = null
  let bestScore = 0

  for (const [name, { schema, keys }] of registry) {
    if (keys.size === 0) continue
    // Jaccard similarity = intersection / union
    const intersection = [...objKeys].filter((k) => keys.has(k)).length
    const union = new Set([...objKeys, ...keys]).size
    const score = intersection / union

    if (score > bestScore && score > 0.5) {
      bestScore = score
      bestMatch = { name, schema }
    }
  }

  return bestMatch
}

/**
 * Validate JSON response blocks in user story files against Zod API schemas.
 */
function validateJsonResponseCoherence(
  files: readonly UserStoryFileValidation[],
  registry: Map<string, { schema: unknown; keys: Set<string> }>
): StoryValidationIssue[] {
  const issues: StoryValidationIssue[] = []

  for (const file of files) {
    const content = file.rawContent
    if (!content) continue

    const jsonBlocks = extractJsonResponseBlocks(content)

    for (const block of jsonBlocks) {
      let parsed: unknown
      try {
        parsed = JSON.parse(block.json)
      } catch {
        // Unparseable JSON — skip silently (could be pseudo-code or partial)
        continue
      }

      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) continue

      const match = findMatchingApiSchema(parsed as Record<string, unknown>, registry)
      if (!match) continue // No matching schema found — skip silently

      // Run safeParse for full validation
      const zodSchema = match.schema as {
        safeParse: (data: unknown) => {
          success: boolean
          error?: { issues: Array<{ path: Array<string | number>; message: string }> }
        }
      }
      const result = zodSchema.safeParse(parsed)
      if (!result.success && result.error) {
        const errorSummary = result.error.issues
          .slice(0, 3)
          .map((iss) => `${iss.path.join('.')}: ${iss.message}`)
          .join('; ')
        issues.push({
          file: file.relativePath,
          severity: 'warning',
          message: `JSON block does not match ${match.name}: ${errorSummary}`,
          line: block.lineNumber,
        })
      }
    }
  }

  return issues
}

/**
 * Run schema coherence validation: YAML app config + JSON API responses.
 * Returns StoryValidationIssue[] with severity 'warning'.
 */
function validateSchemaCoherence(
  files: readonly UserStoryFileValidation[]
): StoryValidationIssue[] {
  // Part 1: YAML config validation against AppSchema
  const jsonSchema = generateAppJsonSchema() as Record<string, unknown>
  const { paths: validPaths, recordPaths } = extractValidPaths(jsonSchema)
  const topLevelKeys = new Set<string>()
  const props = jsonSchema['properties'] as Record<string, unknown> | undefined
  if (props) {
    for (const key of Object.keys(props)) {
      topLevelKeys.add(key)
    }
  }

  const yamlIssues = validateYamlConfigCoherence(files, validPaths, recordPaths, topLevelKeys)

  // Part 2: JSON API response validation against Zod schemas
  const apiRegistry = buildApiSchemaRegistry()
  const jsonIssues = validateJsonResponseCoherence(files, apiRegistry)

  return [...yamlIssues, ...jsonIssues]
}

// =============================================================================
// Schema-to-User-Story Linking Validation
// =============================================================================

/**
 * Recursively discover all schema .ts files in SCHEMA_MODEL_DIRS,
 * excluding test files and barrel exports (index.ts).
 */
async function discoverSchemaFiles(): Promise<readonly string[]> {
  const cwd = process.cwd()
  const files: string[] = []

  async function walk(dir: string) {
    try {
      const entries = await readdir(join(cwd, dir), { withFileTypes: true })
      for (const entry of entries) {
        const relPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(relPath)
        } else if (
          entry.name.endsWith('.ts') &&
          !entry.name.endsWith('.test.ts') &&
          entry.name !== 'index.ts'
        ) {
          files.push(relPath)
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
  }

  for (const dir of SCHEMA_MODEL_DIRS) {
    await walk(dir)
  }
  return files.sort()
}

/**
 * Collect ALL schema references from both file-level headers and per-story
 * Implementation References sections across all user story files.
 */
function collectAllSchemaRefs(files: readonly UserStoryFileValidation[]): Set<string> {
  const refs = new Set<string>()

  for (const file of files) {
    // Extract header-level refs: > **Schema**: `path1`, `path2`
    const headerMatch = FILE_HEADER_SCHEMA_PATTERN.exec(file.rawContent)
    if (headerMatch?.[1]) {
      const backtickRefs = headerMatch[1].matchAll(/`([^`]+)`/g)
      for (const m of backtickRefs) {
        if (m[1]) refs.add(m[1])
      }
    }

    // Collect per-story Implementation References schema refs
    for (const story of file.stories) {
      for (const ref of story.schemaRefs) {
        refs.add(ref)
      }
    }
  }

  return refs
}

/**
 * Check if a schema file is covered by any ref (exact match or directory prefix).
 * Refs ending in .ts are matched exactly; all others are treated as directory
 * prefixes (with or without trailing slash).
 */
function isSchemaFileCovered(schemaFile: string, refs: Set<string>): boolean {
  for (const ref of refs) {
    if (ref.endsWith('.ts')) {
      if (schemaFile === ref) return true
    } else {
      const dirPrefix = ref.endsWith('/') ? ref : `${ref}/`
      if (schemaFile.startsWith(dirPrefix)) return true
    }
  }
  return false
}

/**
 * Validate that every schema file in SCHEMA_MODEL_DIRS is referenced
 * by at least one user story (either in header or Implementation References).
 * Groups orphaned files by parent directory when 3+ are unlinked.
 */
async function validateSchemaLinking(
  files: readonly UserStoryFileValidation[]
): Promise<readonly StoryValidationIssue[]> {
  const schemaFiles = await discoverSchemaFiles()
  const refs = collectAllSchemaRefs(files)
  const issues: StoryValidationIssue[] = []

  // Find unlinked files
  const unlinked = schemaFiles.filter((f) => !isSchemaFileCovered(f, refs))

  // Group by parent directory for concise reporting
  const byDir = new Map<string, string[]>()
  for (const f of unlinked) {
    const dir = f.substring(0, f.lastIndexOf('/') + 1)
    const existing = byDir.get(dir) ?? []
    existing.push(f)
    byDir.set(dir, existing)
  }

  for (const [dir, dirFiles] of byDir) {
    if (dirFiles.length >= 3) {
      issues.push({
        file: 'schema-linking',
        severity: 'warning',
        message: `${dirFiles.length} schema files under ${dir} not linked to any user story`,
      })
    } else {
      for (const f of dirFiles) {
        issues.push({
          file: 'schema-linking',
          severity: 'warning',
          message: `Schema file not linked to any user story: ${f}`,
        })
      }
    }
  }

  return issues
}

/**
 * Run user story validation and return all issues.
 */
async function runUserStoryValidation(allSpecIds: Set<string>): Promise<{
  files: UserStoryFileValidation[]
  issues: StoryValidationIssue[]
  totalStories: number
  totalACs: number
}> {
  // Find all user story files
  const userStoryFiles = await findUserStoryFiles(USER_STORIES_DIR)
  const storyFiles = userStoryFiles.filter((f) => !f.endsWith('README.md'))

  if (storyFiles.length === 0) {
    return { files: [], issues: [], totalStories: 0, totalACs: 0 }
  }

  // Parse all files
  const parsedFiles: UserStoryFileValidation[] = []
  for (const filePath of storyFiles) {
    const content = await readFile(filePath, 'utf-8')
    const relativePath = filePath.replace(`${USER_STORIES_DIR}/`, '')
    parsedFiles.push(parseUserStoryFileForValidation(relativePath, content))
  }

  // Validate file references
  const refIssues = await validateFileReferences(parsedFiles)

  // Validate spec ID references (reuses allSpecIds from spec analysis)
  const specIdIssues = validateSpecIdReferences(parsedFiles, allSpecIds)

  // Validate schema coherence (YAML app config + JSON API responses)
  const schemaCoherenceIssues = validateSchemaCoherence(parsedFiles)

  // Validate schema-to-user-story linking (every schema file must be documented)
  const schemaLinkingIssues = await validateSchemaLinking(parsedFiles)

  // Collect all issues
  const allIssues: StoryValidationIssue[] = [
    ...parsedFiles.flatMap((f) => f.issues),
    ...refIssues,
    ...specIdIssues,
    ...schemaCoherenceIssues,
    ...schemaLinkingIssues,
  ]

  const totalStories = parsedFiles.reduce((sum, f) => sum + f.stories.length, 0)
  const totalACs = parsedFiles.reduce(
    (sum, f) => sum + f.stories.reduce((s, story) => s + story.acIds.length, 0),
    0
  )

  return { files: parsedFiles, issues: allIssues, totalStories, totalACs }
}

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
    // IMPORTANT: Skip parentheses inside strings, comments, AND regex literals
    const testStart = matchIndex
    let parenCount = 0
    let testEnd = testStart
    let foundFirstParen = false
    let inString: string | null = null // Track which quote char started the string
    let inSingleLineComment = false // Track // comments
    let inMultiLineComment = false // Track /* */ comments
    let inRegex = false // Track /regex/ literals
    let lastSignificantChar = '' // Track last non-whitespace char for regex detection

    // Characters that typically precede a regex literal (not division)
    const regexPreceders = new Set([
      '(',
      ',',
      '=',
      ':',
      '[',
      '!',
      '&',
      '|',
      '?',
      '{',
      '}',
      ';',
      '\n',
    ])

    for (let i = testStart; i < content.length; i++) {
      const char = content[i]
      if (char === undefined) continue // Guard for TypeScript strict mode
      const prevChar = i > 0 ? content[i - 1] : ''
      const nextChar = i < content.length - 1 ? content[i + 1] : ''

      // Handle single-line comment end (newline)
      if (inSingleLineComment && char === '\n') {
        inSingleLineComment = false
        lastSignificantChar = '\n'
        continue
      }

      // Handle multi-line comment end
      if (inMultiLineComment && char === '*' && nextChar === '/') {
        inMultiLineComment = false
        i++ // Skip the '/'
        continue
      }

      // Handle regex end (unescaped /)
      if (inRegex && char === '/' && prevChar !== '\\') {
        inRegex = false
        lastSignificantChar = '/'
        continue
      }

      // Skip everything inside comments
      if (inSingleLineComment || inMultiLineComment) {
        continue
      }

      // Skip everything inside regex (but handle escaped chars)
      if (inRegex) {
        if (char === '\\' && nextChar) {
          i++ // Skip the escaped character
        }
        continue
      }

      // Detect comment or regex start (only when not in string)
      if (inString === null) {
        if (char === '/' && nextChar === '/') {
          inSingleLineComment = true
          i++ // Skip the second '/'
          continue
        }
        if (char === '/' && nextChar === '*') {
          inMultiLineComment = true
          i++ // Skip the '*'
          continue
        }
        // Detect regex literal: / followed by non-/ and non-* after a regex-preceding char
        if (
          char === '/' &&
          nextChar !== '/' &&
          nextChar !== '*' &&
          regexPreceders.has(lastSignificantChar)
        ) {
          inRegex = true
          continue
        }
      }

      // Handle string boundaries (skip escaped quotes) - only when not in comment
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (inString === null) {
          inString = char // Enter string
        } else if (inString === char) {
          inString = null // Exit string
        }
        // Don't continue - we still need to check parenCount at end of loop
      }

      // Only count parentheses outside of strings, comments, and regex
      if (inString === null) {
        if (char === '(') {
          parenCount++
          foundFirstParen = true
        } else if (char === ')') {
          parenCount--
        }
      }

      // Track last significant (non-whitespace) character for regex detection
      if (inString === null && !/\s/.test(char)) {
        lastSignificantChar = char
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
    // IMPORTANT: Skip parentheses inside strings, comments, AND regex literals to avoid miscounting
    const testStart = matchIndex
    let parenCount = 0
    let testEnd = testStart
    let foundFirstParen = false
    let inString: string | null = null // Track which quote char started the string
    let inSingleLineComment = false // Track // comments
    let inMultiLineComment = false // Track /* */ comments
    let inRegex = false // Track /regex/ literals
    let lastSignificantChar = '' // Track last non-whitespace char for regex detection

    // Characters that typically precede a regex literal (not division)
    const regexPreceders = new Set([
      '(',
      ',',
      '=',
      ':',
      '[',
      '!',
      '&',
      '|',
      '?',
      '{',
      '}',
      ';',
      '\n',
    ])

    for (let i = testStart; i < content.length; i++) {
      const char = content[i]
      if (char === undefined) continue // Guard for TypeScript strict mode
      const prevChar = i > 0 ? content[i - 1] : ''
      const nextChar = i < content.length - 1 ? content[i + 1] : ''

      // Handle single-line comment end (newline)
      if (inSingleLineComment && char === '\n') {
        inSingleLineComment = false
        lastSignificantChar = '\n'
        continue
      }

      // Handle multi-line comment end
      if (inMultiLineComment && char === '*' && nextChar === '/') {
        inMultiLineComment = false
        i++ // Skip the '/'
        continue
      }

      // Handle regex end (unescaped /)
      if (inRegex && char === '/' && prevChar !== '\\') {
        inRegex = false
        lastSignificantChar = '/'
        continue
      }

      // Skip everything inside comments
      if (inSingleLineComment || inMultiLineComment) {
        continue
      }

      // Skip everything inside regex (but handle escaped chars)
      if (inRegex) {
        if (char === '\\' && nextChar) {
          i++ // Skip the escaped character
        }
        continue
      }

      // Detect comment or regex start (only when not in string)
      if (inString === null) {
        if (char === '/' && nextChar === '/') {
          inSingleLineComment = true
          i++ // Skip the second '/'
          continue
        }
        if (char === '/' && nextChar === '*') {
          inMultiLineComment = true
          i++ // Skip the '*'
          continue
        }
        // Detect regex literal: / followed by non-/ and non-* after a regex-preceding char
        if (
          char === '/' &&
          nextChar !== '/' &&
          nextChar !== '*' &&
          regexPreceders.has(lastSignificantChar)
        ) {
          inRegex = true
          continue
        }
      }

      // Handle string boundaries (skip escaped quotes) - only when not in comment
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (inString === null) {
          inString = char // Enter string
        } else if (inString === char) {
          inString = null // Exit string
        }
        // Don't continue - we still need to check parenCount at end of loop
      }

      // Only count parentheses outside of strings, comments, and regex
      if (inString === null) {
        if (char === '(') {
          parenCount++
          foundFirstParen = true
        } else if (char === ')') {
          parenCount--
        }
      }

      // Track last significant (non-whitespace) character for regex detection
      if (inString === null && !/\s/.test(char)) {
        lastSignificantChar = char
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

function analyzeQuality(file: SpecFile, content: string): QualityIssue[] {
  const issues: QualityIssue[] = []

  for (const test of file.tests) {
    // Skip regression tests - they are mirrors of @spec tests and don't need individual validation
    // Regression tests are identified by @regression tag OR -REGRESSION suffix in spec ID
    const isRegressionTest =
      test.tag === '@regression' || (test.id !== null && test.id.endsWith('-REGRESSION'))
    if (isRegressionTest) {
      continue
    }

    // Check for spec ID - required for @spec tests
    if (!test.id && test.tag === '@spec') {
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

  // Check header "Spec Count: X" matches actual @spec count
  const headerLines = content.split('\n').slice(0, 50).join('\n')
  const specCountMatch = headerLines.match(/\*\s*Spec Count:\s*(\d+)/)
  if (specCountMatch?.[1]) {
    const headerCount = parseInt(specCountMatch[1], 10)
    const actualCount = specTests.length

    if (headerCount !== actualCount) {
      issues.push({
        type: 'error',
        code: 'HEADER_COUNT_MISMATCH',
        message: `Header "Spec Count: ${headerCount}" does not match actual @spec count: ${actualCount}`,
      })
    }
  }

  if (specTests.length > 0 && regressionTests.length === 0) {
    issues.push({
      type: 'suggestion',
      code: 'MISSING_REGRESSION',
      message: `File has @spec tests but no @regression test for consolidated workflow`,
    })
  }

  // Check for sequential spec IDs (exclude regression tests - they have -REGRESSION suffix, not numeric)
  const specTestIds = file.tests
    .filter((t) => t.tag === '@spec' && t.id && !t.id.endsWith('-REGRESSION'))
    .map((t) => t.id)
    .filter(Boolean) as string[]
  if (specTestIds.length > 1) {
    const idNumbers = specTestIds.map((id) => {
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
          message: `Spec IDs are not sequential (gap between ${specTestIds[i - 1]} and ${specTestIds[i]})`,
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

  file.issues = analyzeQuality(file, content)

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

    // Skip coverage gap detection for 100% passing domains
    // If all tests pass (no fixme tests), the domain is complete and doesn't need more tests
    const totalTests = allTests.length
    const fixmeTests = allTests.filter((t) => t.isFixme).length
    if (totalTests > 0 && fixmeTests === 0) {
      // Domain is 100% complete - skip coverage gap warnings
      continue
    }

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
// User Story Analysis Functions
// =============================================================================

/**
 * Find all user story markdown files in docs/user-stories/
 */
async function findUserStoryFiles(dir: string): Promise<string[]> {
  const files: string[] = []

  async function walk(currentDir: string) {
    try {
      const entries = await readdir(currentDir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name)

        if (entry.isDirectory()) {
          await walk(fullPath)
        } else if (entry.name.endsWith('.md') && entry.name !== 'README.md') {
          // Parse all markdown files except README.md
          files.push(fullPath)
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
  }

  await walk(dir)
  return files.sort()
}

/**
 * Parse a user story markdown file and extract all user stories with their acceptance criteria.
 */
function parseUserStoryFile(content: string, filePath: string): UserStory[] {
  const stories: UserStory[] = []

  // Extract domain, feature area, and role from file metadata
  const domainMatch = content.match(DOMAIN_PATTERN)
  const featureAreaMatch = content.match(FEATURE_AREA_PATTERN)
  const roleMatch = content.match(ROLE_PATTERN)

  const domain = domainMatch?.[1] || 'unknown'
  const featureArea = featureAreaMatch?.[1] || 'unknown'
  const role = roleMatch?.[1]?.trim() || 'unknown'

  // Split content by user story headers (## or ### depending on format)
  const storyBlocks = content
    .split(/(?=^#{2,3}\s+US-)/m)
    .filter((block) => /^#{2,3}\s+US-/.test(block))

  for (const block of storyBlocks) {
    // Extract user story ID and title (## US-AUTH-EMAIL-001: Title or ### US-...)
    const idMatch = block.match(/^#{2,3}\s+(US-[A-Z]+-[A-Z0-9-]+-\d{3}):\s+(.+)$/m)
    if (!idMatch) continue

    const storyId = idMatch[1]
    const title = idMatch[2]?.trim() || ''

    // Extract story text
    const storyMatch = block.match(/\*\*Story\*\*:\s*(.+)$/m)
    const story = storyMatch?.[1]?.trim() || ''

    // Extract status
    const statusMatch = block.match(USER_STORY_STATUS_PATTERN)
    let status: 'complete' | 'partial' | 'not-started' = 'not-started'
    if (statusMatch) {
      const statusChar = statusMatch[1]
      if (statusChar === 'x') status = 'complete'
      else if (statusChar === '~') status = 'partial'
    }

    // Extract acceptance criteria from table
    const acceptanceCriteria: AcceptanceCriterion[] = []

    // Reset regex state
    ACCEPTANCE_CRITERIA_TABLE_ROW_PATTERN.lastIndex = 0

    let acMatch: RegExpExecArray | null
    while ((acMatch = ACCEPTANCE_CRITERIA_TABLE_ROW_PATTERN.exec(block)) !== null) {
      const acId = acMatch[1]
      const criterion = acMatch[2]?.trim() || ''
      const specTestId = acMatch[3] || null // May be empty or missing

      // Status is determined by whether spec test exists and passes
      // For now, mark as complete if spec ID is linked
      const acStatus: 'complete' | 'partial' | 'not-started' = specTestId
        ? 'complete'
        : 'not-started'

      if (acId) {
        acceptanceCriteria.push({
          id: acId,
          criterion,
          specTestId,
          schema: '', // Schema column removed in new format
          status: acStatus,
        })
      }
    }

    if (storyId) {
      stories.push({
        id: storyId,
        title,
        story,
        status,
        acceptanceCriteria,
        filePath: relative(process.cwd(), filePath),
        domain,
        featureArea,
        role,
      })
    }
  }

  return stories
}

/**
 * Parse all user story files and return metrics.
 */
async function parseUserStoryFiles(
  files: SpecFile[],
  fixmeSpecIds: Set<string>,
  passingSpecIds: Set<string>
): Promise<UserStoryMetrics> {
  const userStoryFiles = await findUserStoryFiles(USER_STORIES_DIR)
  const allStories: UserStory[] = []

  for (const filePath of userStoryFiles) {
    const content = await readFile(filePath, 'utf-8')
    const stories = parseUserStoryFile(content, filePath)
    allStories.push(...stories)
  }

  // Categorize stories based on their spec IDs
  const storiesToSpecify: UserStory[] = []
  const storiesSpecifiedNotImplemented: UserStory[] = []
  const storiesSpecifiedAndImplemented: UserStory[] = []

  for (const story of allStories) {
    // Get all spec IDs linked to this story's acceptance criteria
    const linkedSpecIds = story.acceptanceCriteria
      .map((ac) => ac.specTestId)
      .filter((id): id is string => id !== null)

    if (linkedSpecIds.length === 0) {
      // No spec IDs linked - needs specification
      storiesToSpecify.push(story)
    } else {
      // Check if ALL linked spec IDs are passing or if some are still fixme
      const allImplemented = linkedSpecIds.every((id) => passingSpecIds.has(id))
      const someFixme = linkedSpecIds.some((id) => fixmeSpecIds.has(id))

      if (allImplemented) {
        storiesSpecifiedAndImplemented.push(story)
      } else if (someFixme) {
        storiesSpecifiedNotImplemented.push(story)
      } else {
        // Spec IDs linked but not found in codebase - treat as needs specification
        storiesToSpecify.push(story)
      }
    }
  }

  // Calculate percentages
  const total = allStories.length || 1 // Avoid division by zero
  const storiesToSpecifyPercent = Math.round((storiesToSpecify.length / total) * 100)
  const storiesSpecifiedNotImplementedPercent = Math.round(
    (storiesSpecifiedNotImplemented.length / total) * 100
  )
  const storiesSpecifiedAndImplementedPercent = Math.round(
    (storiesSpecifiedAndImplemented.length / total) * 100
  )

  // Total criteria count
  const totalCriteria = allStories.reduce((sum, s) => sum + s.acceptanceCriteria.length, 0)

  // Organize by domain
  const byDomain = new Map<string, UserStory[]>()
  for (const story of allStories) {
    const domain = story.domain.toUpperCase()
    if (!byDomain.has(domain)) {
      byDomain.set(domain, [])
    }
    byDomain.get(domain)!.push(story)
  }

  return {
    totalStories: allStories.length,
    totalCriteria,
    storiesToSpecify,
    storiesToSpecifyPercent,
    storiesSpecifiedNotImplemented,
    storiesSpecifiedNotImplementedPercent,
    storiesSpecifiedAndImplemented,
    storiesSpecifiedAndImplementedPercent,
    byDomain,
  }
}

/**
 * Update user story files with test status column in acceptance criteria tables.
 *
 * Status values:
 * - ✅ = Test is passing (spec ID found in passingSpecIds)
 * - ⏳ = Test is .fixme() (spec ID found in fixmeSpecIds)
 * - ❓ = Spec ID not found in codebase
 * - (empty) = No spec ID linked
 */
async function updateUserStoryFiles(
  fixmeSpecIds: Set<string>,
  passingSpecIds: Set<string>
): Promise<{ updated: number; unchanged: number; changes: string[] }> {
  const userStoryFiles = await findUserStoryFiles(USER_STORIES_DIR)
  let updated = 0
  let unchanged = 0
  const changes: string[] = []

  for (const filePath of userStoryFiles) {
    const content = await readFile(filePath, 'utf-8')
    const updatedContent = updateAcceptanceCriteriaTables(content, fixmeSpecIds, passingSpecIds)

    // Format with Prettier before comparing
    const prettierConfig = await prettier.resolveConfig(filePath)
    const formattedContent = await prettier.format(updatedContent, {
      ...prettierConfig,
      parser: 'markdown',
    })

    // Compare formatted content with original to detect actual changes
    if (formattedContent !== content) {
      await writeFile(filePath, formattedContent)
      updated++
      changes.push(relative(process.cwd(), filePath))
    } else {
      unchanged++
    }
  }

  return { updated, unchanged, changes }
}

/**
 * Update acceptance criteria tables in markdown content to add/update Status column.
 *
 * Handles tables with format:
 * | ID | Criterion | E2E Spec |
 * | -- | --------- | -------- |
 * | AC-001 | Criterion text | `SPEC-ID-001` |
 *
 * Transforms to:
 * | ID | Criterion | E2E Spec | Status |
 * | -- | --------- | -------- | ------ |
 * | AC-001 | Criterion text | `SPEC-ID-001` | ✅ |
 */
function updateAcceptanceCriteriaTables(
  content: string,
  fixmeSpecIds: Set<string>,
  passingSpecIds: Set<string>
): string {
  // Match acceptance criteria tables (header row + separator row + data rows)
  // Header pattern: | ID | Criterion | E2E Spec | (optional Status column)
  const tablePattern =
    /(\|\s*ID\s*\|\s*Criterion\s*\|\s*E2E Spec\s*)(\|\s*Status\s*)?(\s*\|?\s*\n)(\|\s*[-:]+\s*\|\s*[-:]+\s*\|\s*[-:]+\s*)(\|\s*[-:]+\s*)?(\s*\|?\s*\n)((?:\|[^\n]+\|\s*\n?)+)/gi

  return content.replace(
    tablePattern,
    (
      _match,
      headerBase: string,
      _existingStatusHeader: string | undefined,
      headerEnd: string,
      separatorBase: string,
      _existingStatusSeparator: string | undefined,
      separatorEnd: string,
      dataRows: string
    ) => {
      // Build new header with Status column
      const newHeader = `${headerBase.trimEnd()}| Status ${headerEnd}`

      // Build new separator with Status column
      const newSeparator = `${separatorBase.trimEnd()}| ------ ${separatorEnd}`

      // Process each data row
      const newDataRows = dataRows
        .split('\n')
        .filter((row) => row.trim())
        .map((row) => {
          // Parse the row to extract spec ID
          // Format: | AC-001 | Criterion text | `SPEC-ID-001` | (optional existing status)
          const rowMatch = row.match(
            /^\|\s*(AC-\d{3})\s*\|\s*([^|]+)\s*\|\s*`?([A-Z]+-[A-Z0-9-]+-(?:\d{3}|REGRESSION))?`?\s*(?:\|\s*[^|]*)?(\s*\|?\s*)$/
          )

          if (!rowMatch) {
            // If row doesn't match expected format, return as-is but try to add empty status
            if (row.match(/^\|.*\|.*\|.*\|$/)) {
              // Row has 3 columns, add status column
              return row.replace(/\|(\s*)$/, '|  |')
            }
            return row
          }

          const acId = rowMatch[1]
          const criterion = rowMatch[2]?.trim() || ''
          const specId = rowMatch[3] || ''

          // Determine status based on spec ID
          let status = ''
          if (!specId) {
            status = '' // No spec ID linked - leave empty
          } else if (passingSpecIds.has(specId)) {
            status = '✅'
          } else if (fixmeSpecIds.has(specId)) {
            status = '⏳'
          } else {
            status = '❓' // Spec ID exists but not found in codebase
          }

          // Rebuild the row with status column
          // Preserve original formatting as much as possible
          const specIdFormatted = specId ? `\`${specId}\`` : ''
          return `| ${acId} | ${criterion} | ${specIdFormatted} | ${status} |`
        })
        .join('\n')

      return `${newHeader}${newSeparator}${newDataRows}\n`
    }
  )
}

/**
 * Detect spec IDs in E2E tests that are NOT linked to any user story.
 * These are "orphaned" specs that exist without documented requirements.
 */
function detectOrphanedSpecIds(
  files: SpecFile[],
  userStoryMetrics: UserStoryMetrics
): OrphanedSpecId[] {
  // Collect all spec IDs referenced in user stories
  const linkedSpecIds = new Set<string>()

  for (const stories of userStoryMetrics.byDomain.values()) {
    for (const story of stories) {
      for (const ac of story.acceptanceCriteria) {
        if (ac.specTestId) {
          linkedSpecIds.add(ac.specTestId)
        }
      }
    }
  }

  // Find spec IDs in E2E tests that are not in user stories
  const orphaned: OrphanedSpecId[] = []

  for (const file of files) {
    for (const test of file.tests) {
      if (test.id && !linkedSpecIds.has(test.id)) {
        orphaned.push({
          specId: test.id,
          file: file.relativePath,
          line: test.lineNumber,
          testName: test.name,
        })
      }
    }
  }

  return orphaned.sort((a, b) => a.specId.localeCompare(b.specId))
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
  // Also matches TDD pipeline format: "[TDD] Implement API-TABLES-RECORDS-LIST-009 | Attempt 5/5 (#7054)"
  const specIdPattern = /([A-Z]+-[A-Z0-9-]+-\d{3})/

  try {
    // Get all spec-related commits in the last 90 days
    // Uses multiple --grep flags (implicit OR) to match:
    // 1. Conventional commits: fix:, test:, feat:, refactor:, chore: with spec IDs
    // 2. TDD pipeline commits: [TDD] Implement <SPEC-ID> | Attempt X/N (#PR)
    // 3. TDD activation commits: test(tdd): activate <SPEC-ID>
    const { stdout } = await execAsync(
      'git log --oneline --since="90 days ago" --extended-regexp' +
        ' --grep="^(fix|test|feat|refactor|chore)(\\([^)]*\\))?:.*[A-Z]+-[A-Z0-9-]+-([0-9]{3}|REGRESSION)"' +
        ' --grep="^\\[TDD\\].*[A-Z]+-[A-Z0-9-]+-([0-9]{3}|REGRESSION)"' +
        ' --grep="^test\\(tdd\\):.*[A-Z]+-[A-Z0-9-]+-([0-9]{3}|REGRESSION)"' +
        ' --format="%H|%aI|%s"',
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
        // Detect source: TDD pipeline commits start with "[TDD]"
        const source: 'tdd-pipeline' | 'manual' = message?.startsWith('[TDD]')
          ? 'tdd-pipeline'
          : 'manual'
        return {
          hash: hash || '',
          date: date || '',
          specId: match?.[1] || null,
          source,
        }
      })
      .filter((c) => c.specId !== null) as Array<{
      hash: string
      date: string
      specId: string
      source: 'tdd-pipeline' | 'manual'
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
      source: c.source,
    }))

    // Count by source
    const fixedByPipeline = commits.filter((c) => c.source === 'tdd-pipeline').length
    const fixedManually = commits.filter((c) => c.source === 'manual').length

    return {
      totalFixed: commits.length,
      fixedByPipeline,
      fixedManually,
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
      fixedByPipeline: 0,
      fixedManually: 0,
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

    // Determine status based on progress
    let status: '🟢' | '🟡' | '🔴'
    if (progressPercent === 100) {
      status = '🟢'
    } else if (progressPercent >= 50) {
      status = '🟡'
    } else {
      status = '🔴'
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
function getStatusLabel(progressPercent: number): string {
  if (progressPercent === 100) return 'Complete'
  if (progressPercent >= 80) return 'Almost Done'
  if (progressPercent >= 50) return 'In Progress'
  return 'Early Stage'
}

/**
 * Get overall health status for executive summary.
 */
function getOverallHealth(
  progressPercent: number,
  avgFixesPerDay: number
): { emoji: string; label: string } {
  if (progressPercent === 100) return { emoji: '🟢', label: 'Complete' }
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
  const health = getOverallHealth(progressPercent, state.tddAutomation.avgFixesPerDay)

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
  lines.push('> Auto-generated by `bun run progress` • Track test coverage and TDD progress')
  lines.push('')

  // ==========================================================================
  // EXECUTIVE SUMMARY (consolidated table - no prose duplication)
  // ==========================================================================
  lines.push('## 🎯 Executive Summary')
  lines.push('')
  lines.push('| Category | Metric | Status |')
  lines.push('|----------|--------|--------|')
  lines.push(
    `| **Overall Progress** | [${'█'.repeat(progressFilled)}${'░'.repeat(progressEmpty)}] ${progressPercent}% (${state.summary.totalPassing}/${state.summary.totalTests} tests) | ${health.emoji} ${health.label} |`
  )
  lines.push(
    `| **Daily Velocity** | ${state.tddAutomation.avgFixesPerDay} specs/day | ${state.tddAutomation.avgFixesPerDay >= 25 ? '🟢 Healthy' : state.tddAutomation.avgFixesPerDay >= 15 ? '🟡 Moderate' : '🔴 Slow'} |`
  )
  lines.push(
    `| **Quality Score** | ${state.summary.qualityScore}% | ${state.summary.qualityScore >= 90 ? '🟢 Excellent' : state.summary.qualityScore >= 75 ? '🟡 Good' : '🔴 Needs Work'} |`
  )
  if (state.tddAutomation.estimatedCompletionDate) {
    lines.push(
      `| **Estimated Completion** | ${state.tddAutomation.estimatedCompletionDate} (${etaText}) | ${health.emoji} ${health.label} |`
    )
  }
  lines.push('')

  // ==========================================================================
  // TABLE OF CONTENTS
  // ==========================================================================
  lines.push('## 📑 Table of Contents')
  lines.push('')
  lines.push('- [Executive Summary](#-executive-summary)')
  lines.push('- [Next Steps](#-next-steps)')
  lines.push('- [Detailed Metrics](#-detailed-metrics)')
  lines.push('- [User Stories Metrics](#-user-stories-metrics)')
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

  // Priority 1 - Immediate Action (duplicate spec IDs only)
  if (state.duplicateSpecIds.length > 0) {
    lines.push('### 🚨 Priority 1 - Immediate Action')
    lines.push('')
    lines.push(
      `- **Fix ${state.duplicateSpecIds.length} duplicate spec IDs** - Critical for TDD queue`
    )
    for (const dup of state.duplicateSpecIds.slice(0, 3)) {
      lines.push(`  - \`${dup.specId}\` appears ${dup.locations.length} times`)
    }
    lines.push('')
  }

  // Priority 2 - This Week (coverage gaps only)
  if (state.coverageGaps.length > 0) {
    lines.push('### ⚠️ Priority 2 - This Week')
    lines.push('')
    lines.push(
      `- **Review ${state.coverageGaps.length} coverage gaps** - Add missing test scenarios`
    )
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
  lines.push(`| 🔄 Duplicate IDs | ${state.summary.duplicateSpecIds} |`)
  lines.push(`| 🔗 Orphaned Spec IDs | ${state.summary.orphanedSpecIds} |`)
  lines.push('')

  // Progress bar removed - now only in Executive Summary to avoid redundancy

  // ==========================================================================
  // USER STORIES METRICS
  // ==========================================================================
  if (state.userStoryMetrics && state.userStoryMetrics.totalStories > 0) {
    const metrics = state.userStoryMetrics

    lines.push('## 📋 User Stories Metrics')
    lines.push('')
    lines.push('| Category | Count | Percentage |')
    lines.push('|----------|-------|------------|')
    lines.push(`| **Total User Stories** | ${metrics.totalStories} | - |`)
    lines.push(`| **Total Acceptance Criteria** | ${metrics.totalCriteria} | - |`)
    lines.push(
      `| 🟢 Specified & Implemented | ${metrics.storiesSpecifiedAndImplemented.length} | ${metrics.storiesSpecifiedAndImplementedPercent}% |`
    )
    lines.push(
      `| 🟡 Specified, Not Implemented | ${metrics.storiesSpecifiedNotImplemented.length} | ${metrics.storiesSpecifiedNotImplementedPercent}% |`
    )
    lines.push(
      `| 🔴 Needs Specification | ${metrics.storiesToSpecify.length} | ${metrics.storiesToSpecifyPercent}% |`
    )
    lines.push('')

    // Progress bar for user story coverage
    const implementedPercent = metrics.storiesSpecifiedAndImplementedPercent
    const implementedFilled = Math.round(implementedPercent / 5)
    const implementedEmpty = 20 - implementedFilled
    lines.push(
      `**User Story Coverage**: [${'█'.repeat(implementedFilled)}${'░'.repeat(implementedEmpty)}] ${implementedPercent}%`
    )
    lines.push('')

    // Breakdown by domain
    if (metrics.byDomain.size > 0) {
      lines.push('### By Domain')
      lines.push('')
      lines.push('| Domain | Stories | Specified | Implemented | Coverage |')
      lines.push('|--------|---------|-----------|-------------|----------|')

      for (const [domain, stories] of metrics.byDomain) {
        const specified = stories.filter((s) =>
          s.acceptanceCriteria.some((ac) => ac.specTestId !== null)
        ).length
        const implemented = stories.filter((s) =>
          metrics.storiesSpecifiedAndImplemented.includes(s)
        ).length
        const coveragePercent =
          stories.length > 0 ? Math.round((implemented / stories.length) * 100) : 0
        lines.push(
          `| ${domain} | ${stories.length} | ${specified} | ${implemented} | ${coveragePercent}% |`
        )
      }
      lines.push('')
    }

    // Stories needing specification
    if (metrics.storiesToSpecify.length > 0) {
      lines.push('<details>')
      lines.push(
        `<summary>🔴 Stories Needing Specification (${metrics.storiesToSpecify.length})</summary>`
      )
      lines.push('')
      for (const story of metrics.storiesToSpecify.slice(0, 20)) {
        lines.push(`- **${story.id}**: ${story.title}`)
        lines.push(`  - File: \`${story.filePath}\``)
        lines.push(`  - Domain: ${story.domain} > ${story.featureArea} > ${story.role}`)
      }
      if (metrics.storiesToSpecify.length > 20) {
        lines.push(`- ... and ${metrics.storiesToSpecify.length - 20} more`)
      }
      lines.push('')
      lines.push('</details>')
      lines.push('')
    }

    // Stories specified but not implemented
    if (metrics.storiesSpecifiedNotImplemented.length > 0) {
      lines.push('<details>')
      lines.push(
        `<summary>🟡 Stories Specified but Not Implemented (${metrics.storiesSpecifiedNotImplemented.length})</summary>`
      )
      lines.push('')
      for (const story of metrics.storiesSpecifiedNotImplemented.slice(0, 20)) {
        const specIds = story.acceptanceCriteria
          .map((ac) => ac.specTestId)
          .filter((id): id is string => id !== null)
        lines.push(`- **${story.id}**: ${story.title}`)
        lines.push(`  - Spec IDs: ${specIds.map((id) => `\`${id}\``).join(', ')}`)
        lines.push(`  - File: \`${story.filePath}\``)
      }
      if (metrics.storiesSpecifiedNotImplemented.length > 20) {
        lines.push(`- ... and ${metrics.storiesSpecifiedNotImplemented.length - 20} more`)
      }
      lines.push('')
      lines.push('</details>')
      lines.push('')
    }
  }

  // ==========================================================================
  // ORPHANED SPEC IDS
  // ==========================================================================
  if (state.orphanedSpecIds.length > 0) {
    lines.push('## 🔗 Orphaned Spec IDs')
    lines.push('')
    lines.push(
      '> **Warning**: These spec IDs exist in E2E tests but are NOT linked to any user story.'
    )
    lines.push('> Every spec should trace back to a user requirement in `docs/user-stories/`.')
    lines.push('')
    lines.push('| Spec ID | File | Line | Test Name |')
    lines.push('|---------|------|------|-----------|')

    for (const orphan of state.orphanedSpecIds.slice(0, 50)) {
      const truncatedName =
        orphan.testName.length > 50 ? orphan.testName.substring(0, 47) + '...' : orphan.testName
      lines.push(
        `| \`${orphan.specId}\` | \`${orphan.file}\` | ${orphan.line} | ${truncatedName} |`
      )
    }

    if (state.orphanedSpecIds.length > 50) {
      lines.push('')
      lines.push(`... and ${state.orphanedSpecIds.length - 50} more orphaned spec IDs`)
    }
    lines.push('')
  }

  // ==========================================================================
  // TDD AUTOMATION
  // ==========================================================================
  if (state.tddAutomation.totalFixed > 0 || state.summary.totalFixme > 0) {
    lines.push('## 🤖 TDD Automation')
    lines.push('')

    // Prose headers removed - ETA already in Executive Summary, details in table below

    lines.push('| Metric | Value |')
    lines.push('|--------|-------|')
    lines.push(`| Tests Fixed (90 days) | ${state.tddAutomation.totalFixed} |`)
    lines.push(`| 🤖 Fixed by TDD Pipeline | ${state.tddAutomation.fixedByPipeline} |`)
    lines.push(`| 👤 Fixed Manually | ${state.tddAutomation.fixedManually} |`)
    lines.push(`| Fixed Last 24h | ${state.tddAutomation.fixedLast24h} |`)
    lines.push(`| Fixed Last 7d | ${state.tddAutomation.fixedLast7d} |`)
    lines.push(`| Fixed Last 30d | ${state.tddAutomation.fixedLast30d} |`)
    lines.push(`| Avg Fixes/Day | ${state.tddAutomation.avgFixesPerDay} |`)
    lines.push(`| Remaining | ${state.summary.totalFixme} |`)
    if (state.tddAutomation.estimatedDaysRemaining !== null) {
      lines.push(`| ETA | ${etaText} (${state.tddAutomation.estimatedCompletionDate || 'N/A'}) |`)
    }
    lines.push('')

    // Recent fixes
    if (state.tddAutomation.recentFixes.length > 0) {
      lines.push('<details>')
      lines.push('<summary>Recent Fixes (last 20)</summary>')
      lines.push('')
      lines.push('| Spec ID | Date | Commit | Source |')
      lines.push('|---------|------|--------|--------|')
      for (const fix of state.tddAutomation.recentFixes) {
        const sourceLabel = fix.source === 'tdd-pipeline' ? '🤖 TDD' : '👤 Manual'
        lines.push(`| \`${fix.specId}\` | ${fix.date} | \`${fix.commitHash}\` | ${sourceLabel} |`)
      }
      lines.push('')
      lines.push('</details>')
      lines.push('')
    }
  }

  // ==========================================================================
  // STRUCTURAL ISSUES (Duplicate IDs, Coverage Gaps)
  // ==========================================================================
  if (state.duplicateSpecIds.length > 0 || state.coverageGaps.length > 0) {
    lines.push('## ⚡ Structural Issues')
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
    const statusLabel = getStatusLabel(domain.progressPercent)

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
      const statusEmoji = file.metadata.fixmeTests > 0 ? '🚧' : '✅'

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
  lines.push('bun run progress')
  lines.push('')
  lines.push('# Run all specs')
  lines.push('bun test:e2e:spec')
  lines.push('')
  lines.push('# Run regression tests')
  lines.push('bun test:e2e:regression')
  lines.push('')
  lines.push('# Verify progress against GitHub')
  lines.push('bun run progress --verify-progress')
  lines.push('```')
  lines.push('')

  return lines.join('\n')
}

// =============================================================================
// Auto-fix helpers
// =============================================================================

/**
 * Fix header "Spec Count: X" to match actual spec count
 * @param filePath - Path to the spec file
 * @param actualCount - Correct spec count
 * @returns true if file was modified, false otherwise
 */
async function fixHeaderCount(filePath: string, actualCount: number): Promise<boolean> {
  const content = await readFile(filePath, 'utf-8')

  // Replace the spec count in the header
  const updatedContent = content.replace(/(\*\s*Spec Count:\s*)\d+/, `$1${actualCount}`)

  if (updatedContent !== content) {
    await writeFile(filePath, updatedContent)
    return true
  }
  return false
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2)
  const filterPattern = args.find((a) => a.startsWith('--filter='))?.replace('--filter=', '')
  const showFixmeOnly = args.includes('--fixme')
  const verifyProgress = args.includes('--verify-progress')
  const shouldFix = args.includes('--fix')
  const shouldUpdateStories = args.includes('--update-stories')
  const strictMode = args.includes('--strict')
  const skipStories = args.includes('--skip-stories')

  console.log('Analyzing spec files...')
  console.log('')

  // Find all spec files
  let specFiles = await findSpecFiles(SPECS_DIR)

  if (filterPattern) {
    // Escape special regex characters to prevent ReDoS attacks (CWE-400/CWE-730)
    const escapedPattern = filterPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escapedPattern)
    specFiles = specFiles.filter((f) => regex.test(f))
    console.log(`Filtered to ${specFiles.length} files matching: ${filterPattern}`)
  } else {
    console.log(`Found ${specFiles.length} spec files`)
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

  // Collect fixme and passing spec IDs for user story analysis
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

  // Parse user stories and calculate metrics
  console.log('Analyzing user stories...')
  const userStoryMetrics = await parseUserStoryFiles(analyzedFiles, fixmeSpecIds, passingSpecIds)
  const orphanedSpecIds = detectOrphanedSpecIds(analyzedFiles, userStoryMetrics)

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
      orphanedSpecIds: orphanedSpecIds.length,
      issuesByType: {
        errors: errorsWithDuplicates,
        warnings: warningsWithDuplicates,
        suggestions: suggestionsWithDuplicates,
      },
    },
    files: analyzedFiles,
    coverageGaps,
    duplicateSpecIds,
    orphanedSpecIds,
    tddAutomation,
    userStoryMetrics,
  }

  // Auto-fix header count mismatches if --fix flag is present
  if (shouldFix) {
    console.log('')
    console.log('Auto-fixing header count mismatches...')

    const filesToFix = analyzedFiles.filter((file) =>
      file.issues.some((issue) => issue.code === 'HEADER_COUNT_MISMATCH')
    )

    if (filesToFix.length === 0) {
      console.log('No header count mismatches to fix')
    } else {
      let fixedCount = 0

      for (const file of filesToFix) {
        const actualCount = file.metadata.specTests

        const wasFixed = await fixHeaderCount(file.path, actualCount)
        if (wasFixed) {
          fixedCount++
          console.log(`  ✅ Fixed: ${file.relativePath} (updated to ${actualCount})`)
        }
      }

      console.log('')
      console.log(`✅ Fixed header count in ${fixedCount} file(s)`)
    }
  }

  // Update user story files with test status if --update-stories flag is present
  if (shouldUpdateStories) {
    console.log('')
    console.log('Updating user story files with test status...')

    const { updated, unchanged, changes } = await updateUserStoryFiles(fixmeSpecIds, passingSpecIds)

    if (updated === 0) {
      console.log('No user story files needed updates')
    } else {
      console.log('')
      for (const change of changes) {
        console.log(`  ✅ Updated: ${change}`)
      }
      console.log('')
      console.log(`✅ Updated ${updated} file(s), ${unchanged} unchanged`)
    }
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
    console.log(`Deleted old file: SPEC-STATE.md (migrated to SPEC-PROGRESS.md)`)
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

  // ── Content Quality Checks (matches quality script visual flow) ──
  // Flow: section header → step checks → summary → final status
  const orphanedCount = orphanedSpecIds.length
  const sep = '─'.repeat(50)
  const wideSep = '─'.repeat(80)

  // ── Step 1: User Story Validation ──
  let storyValidationErrors = 0
  let storyValidationWarnings = 0
  let storyResult: Awaited<ReturnType<typeof runUserStoryValidation>> | null = null
  console.log('')
  console.log(wideSep)
  console.log('Running content quality checks')
  console.log(wideSep)
  console.log('')

  if (!skipStories) {
    console.log('🔄 User Stories...')

    const allSpecIds = new Set<string>()
    for (const file of analyzedFiles) {
      for (const test of file.tests) {
        if (test.id) allSpecIds.add(test.id)
      }
    }

    storyResult = await runUserStoryValidation(allSpecIds)

    if (storyResult.files.length === 0) {
      console.log('⚠️  No user story files found in docs/user-stories/')
    } else {
      const errors = storyResult.issues.filter((i) => i.severity === 'error')
      const warnings = storyResult.issues.filter((i) => i.severity === 'warning')
      const infos = storyResult.issues.filter((i) => i.severity === 'info')
      storyValidationErrors = errors.length
      storyValidationWarnings = warnings.length

      if (errors.length > 0) {
        console.log(`❌ User Stories failed (${errors.length} errors, ${warnings.length} warnings)`)
        for (const issue of errors) {
          const loc = issue.line ? `:${issue.line}` : ''
          console.log(`   ${issue.file}${loc}: ${issue.message}`)
        }
        if (warnings.length > 0 && strictMode) {
          for (const issue of warnings.slice(0, 10)) {
            const loc = issue.line ? `:${issue.line}` : ''
            console.log(`   ${issue.file}${loc}: ${issue.message}`)
          }
          if (warnings.length > 10) {
            console.log(`   ... and ${warnings.length - 10} more warnings`)
          }
        }
      } else {
        console.log(
          `✅ User Stories passed (${storyResult.files.length} files, ${storyResult.totalStories} stories, ${storyResult.totalACs} ACs)`
        )
      }

      if (infos.length > 0 && strictMode) {
        for (const issue of infos.slice(0, 10)) {
          console.log(`   ℹ️  ${issue.file}: ${issue.message}`)
        }
        if (infos.length > 10) {
          console.log(`   ... and ${infos.length - 10} more`)
        }
      }
    }
  } else {
    console.log('⏭️  User Stories skipped (--skip-stories)')
  }

  // ── Step 2: Spec Tests ──
  const specErrors = errorsWithDuplicates
  const specWarnings = warningsWithDuplicates

  if (specErrors > 0) {
    console.log(`❌ Spec Tests failed (${specErrors} errors, ${specWarnings} warnings)`)
    // Show up to 10 errors
    const allErrors = analyzedFiles.flatMap((f) =>
      f.issues.filter((i) => i.type === 'error').map((i) => ({ file: f.relativePath, ...i }))
    )
    for (const issue of allErrors.slice(0, 10)) {
      const loc = issue.line ? `:${issue.line}` : ''
      console.log(`   ${issue.file}${loc}: ${issue.message}`)
    }
    if (allErrors.length > 10) {
      console.log(`   ... and ${allErrors.length - 10} more errors`)
    }
  } else {
    console.log(`✅ Spec Tests passed (${totalTests} tests, ${qualityScore}% quality)`)
  }

  // ── Step 3: TDD Pipeline ──
  if (tddAutomation.totalFixed > 0 || totalFixme > 0) {
    console.log(
      `🔄 TDD Pipeline (${totalFixme} remaining, ${tddAutomation.totalFixed} fixed in 90d)`
    )
  } else {
    console.log('✅ TDD Pipeline (no remaining fixme)')
  }

  // ── Determine pass/fail before choosing output mode ──
  const totalErrors = errorsWithDuplicates + storyValidationErrors
  const totalWarnings = warningsWithDuplicates + storyValidationWarnings
  const totalIssues = totalErrors + totalWarnings
  const hasFailed = totalIssues > 0

  if (hasFailed) {
    // ── Failure mode: show all errors and warnings directly ──
    // This output is optimized for agents (product-specs-architect) to parse and fix issues
    console.log('')
    console.log(sep)
    console.log(`❌ Content Quality: ${totalErrors} error(s), ${totalWarnings} warning(s)`)
    console.log(sep)

    // Collect all spec test issues with file context
    const specIssues = analyzedFiles.flatMap((f) =>
      f.issues
        .filter((i) => i.type === 'error' || i.type === 'warning')
        .map((i) => ({ file: f.relativePath, ...i }))
    )

    // Collect user story issues
    const storyIssues = !skipStories
      ? (storyResult?.issues ?? []).filter(
          (i) => i.severity === 'error' || i.severity === 'warning'
        )
      : []

    // Display spec test errors/warnings
    if (specIssues.length > 0) {
      console.log('')
      console.log('  Spec Tests:')
      for (const issue of specIssues) {
        const severity = issue.type === 'error' ? 'ERROR' : 'WARN'
        const loc = issue.line ? `:${issue.line}` : ''
        console.log(`    [${severity}] ${issue.file}${loc}: ${issue.message}`)
      }
    }

    // Display user story errors/warnings
    if (storyIssues.length > 0) {
      console.log('')
      console.log('  User Stories:')
      for (const issue of storyIssues) {
        const severity = issue.severity === 'error' ? 'ERROR' : 'WARN'
        const loc = issue.line ? `:${issue.line}` : ''
        console.log(`    [${severity}] ${issue.file}${loc}: ${issue.message}`)
      }
    }

    console.log('')
    console.log(sep)
    console.log(`Generated: ${OUTPUT_FILE}`)
    console.log(sep)
  } else {
    // ── Success mode: show full summary report ──
    console.log('')
    console.log(sep)
    console.log('📊 Content Quality Summary')
    console.log(sep)

    // User Stories section
    console.log('')
    console.log('  User Stories')
    if (userStoryMetrics && userStoryMetrics.totalStories > 0) {
      const notSpecCount = userStoryMetrics.storiesToSpecify.length
      const fixmeCount = userStoryMetrics.storiesSpecifiedNotImplemented.length
      const passingCount = userStoryMetrics.storiesSpecifiedAndImplemented.length
      const notSpecPct = userStoryMetrics.storiesToSpecifyPercent
      const fixmePct = userStoryMetrics.storiesSpecifiedNotImplementedPercent
      const passingPct = userStoryMetrics.storiesSpecifiedAndImplementedPercent

      console.log(`  Total               ${userStoryMetrics.totalStories}`)
      if (passingCount > 0) {
        console.log(`  Specified (pass)    ${passingCount} (${passingPct}%)`)
      }
      if (fixmeCount > 0) {
        console.log(`  Specified (fixme)   ${fixmeCount} (${fixmePct}%)`)
      }
      if (notSpecCount > 0) {
        console.log(`  Not specified       ${notSpecCount} (${notSpecPct}%)`)
      }
    } else {
      console.log('  No user stories found')
    }

    // Spec Tests section
    console.log('')
    console.log('  Spec Tests')
    const progressPercent2 = Math.round((totalPassing / Math.max(totalTests, 1)) * 100)
    const barLen = 20
    const filled = Math.round((progressPercent2 / 100) * barLen)
    const progressBar = '█'.repeat(filled) + '░'.repeat(barLen - filled)
    console.log(`  [${progressBar}] ${progressPercent2}%`)
    console.log(`  @spec               ${totalSpecs}`)
    console.log(`  @regression         ${totalRegressions}`)
    console.log(`  Passing             ${totalPassing}`)
    if (totalFixme > 0) {
      console.log(`  Fixme               ${totalFixme}`)
    }
    if (orphanedCount > 0) {
      console.log(`  Orphaned IDs        ${orphanedCount}`)
    }
    console.log(`  Quality Score       ${qualityScore}%`)

    // TDD Pipeline section
    if (tddAutomation.totalFixed > 0 || totalFixme > 0) {
      console.log('')
      console.log('  TDD Pipeline')
      console.log(
        `  Fixed (90d)         ${tddAutomation.totalFixed} (pipeline: ${tddAutomation.fixedByPipeline}, manual: ${tddAutomation.fixedManually})`
      )
      console.log(`  Last 24h            ${tddAutomation.fixedLast24h}`)
      console.log(`  Last 7d             ${tddAutomation.fixedLast7d}`)
      console.log(`  Avg/day             ${tddAutomation.avgFixesPerDay}`)
      console.log(`  Remaining           ${totalFixme}`)
      if (tddAutomation.estimatedDaysRemaining !== null) {
        const days = tddAutomation.estimatedDaysRemaining
        const etaText =
          days === 0
            ? 'less than 1 day'
            : days === 1
              ? '~1 day'
              : days < 7
                ? `~${days} days`
                : days < 30
                  ? `~${Math.ceil(days / 7)} weeks`
                  : `~${Math.ceil(days / 30)} months`
        console.log(`  ETA                 ${etaText} (${tddAutomation.estimatedCompletionDate})`)
      }
    }

    console.log('')
    console.log(sep)
    console.log(`Generated: ${OUTPUT_FILE}`)
    console.log(sep)
  }

  // Show fixme tests for prioritization
  if (showFixmeOnly) {
    console.log('')
    console.log('FIXME TESTS (next to implement):')
    console.log('')
    for (const file of analyzedFiles) {
      const fixmeTests = file.tests.filter((t) => t.isFixme)
      if (fixmeTests.length > 0) {
        console.log(`  ${file.relativePath}`)
        for (const test of fixmeTests) {
          console.log(`    ${test.id || 'NO-ID'}: ${test.name.substring(0, 60)}...`)
        }
        console.log('')
      }
    }
  }

  // Verify progress against GitHub PRs/issues and commits
  if (verifyProgress) {
    console.log('')
    console.log(wideSep)
    console.log('GitHub Verification')
    console.log(wideSep)
    console.log('')

    // Collect fixme and passing spec IDs from analyzed files
    const verifyFixmeIds = new Set<string>()
    const verifyPassingIds = new Set<string>()

    for (const file of analyzedFiles) {
      for (const test of file.tests) {
        if (test.id) {
          if (test.isFixme) {
            verifyFixmeIds.add(test.id)
          } else {
            verifyPassingIds.add(test.id)
          }
        }
      }
    }

    console.log(`Fixme spec IDs:   ${verifyFixmeIds.size}`)
    console.log(`Passing spec IDs: ${verifyPassingIds.size}`)
    console.log('')
    console.log('Fetching GitHub references...')

    const verification = await verifyProgressFromGitHub(verifyFixmeIds, verifyPassingIds)

    const prRefs = verification.allReferences.filter((r) => r.type === 'pr')
    const issueRefs = verification.allReferences.filter((r) => r.type === 'issue')
    const commitRefs = verification.allReferences.filter((r) => r.type === 'commit')

    const uniqueSpecIdsFromPRs = new Set(prRefs.map((r) => r.specId))
    const uniqueSpecIdsFromIssues = new Set(issueRefs.map((r) => r.specId))
    const uniqueSpecIdsFromCommits = new Set(commitRefs.map((r) => r.specId))

    console.log('')
    console.log(`✅ Merged PRs         ${prRefs.length} (${uniqueSpecIdsFromPRs.size} unique)`)
    console.log(
      `✅ Closed Issues      ${issueRefs.length} (${uniqueSpecIdsFromIssues.size} unique)`
    )
    console.log(
      `✅ Commits            ${commitRefs.length} (${uniqueSpecIdsFromCommits.size} unique)`
    )
    console.log(`✅ Total Tracked      ${verification.fixedSpecIds.size} unique spec IDs`)

    if (verification.discrepancies.length > 0) {
      console.log('')
      console.log(`❌ Discrepancies (${verification.discrepancies.length}):`)
      console.log('')
      for (const disc of verification.discrepancies) {
        console.log(`  ${disc.specId} (${disc.status})`)
        console.log(`    ${disc.suggestion}`)
        for (const ref of disc.references.slice(0, 3)) {
          switch (ref.type) {
            case 'pr':
              console.log(`    PR #${ref.number}: ${ref.title.substring(0, 60)}`)
              break
            case 'issue':
              console.log(`    Issue #${ref.number}: ${ref.title.substring(0, 60)}`)
              break
            case 'commit':
              console.log(`    Commit ${ref.hash}: ${ref.title.substring(0, 60)}`)
              break
          }
        }
        if (disc.references.length > 3) {
          console.log(`    ... and ${disc.references.length - 3} more`)
        }
        console.log('')
      }
      console.log('Action: Remove .fixme() from these tests or investigate failures')
    } else {
      console.log('')
      console.log('✅ No discrepancies found')
    }

    const recentPRs = prRefs.slice(0, 10)
    if (recentPRs.length > 0) {
      console.log('')
      console.log('Recent merged PRs:')
      for (const pr of recentPRs) {
        const dateStr = new Date(pr.date).toISOString().substring(0, 16).replace('T', ' ')
        console.log(`  #${pr.number} ${dateStr} ${pr.specId}`)
      }
    }

    console.log(sep)
  }

  // Final status — fail on any errors or warnings
  console.log('')
  if (hasFailed) {
    console.log(`❌ Content quality failed: ${totalErrors} error(s), ${totalWarnings} warning(s)`)
    process.exit(1)
  } else {
    console.log('✅ All content quality checks passed!')
  }

  // Strict mode: also fail on suggestions and orphaned spec IDs
  // Used by `bun run check:all` to enforce zero-issue content quality
  if (strictMode) {
    const totalStrictIssues = totalIssues + suggestionsWithDuplicates + orphanedCount
    if (totalStrictIssues > 0) {
      process.exit(1)
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
