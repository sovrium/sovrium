/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */



import { readdir, readFile, writeFile, unlink, access, stat, mkdir } from 'node:fs/promises'
import { join, relative, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSONSchema } from 'effect'
import * as prettier from 'prettier'
import * as apiSchemas from '../src/domain/models/api'
import { AppSchema } from '../src/domain/models/app'
import { compilePrioritiesSafe } from './tdd-automation/core/compile-priorities'
import { parseFeaturesMd, updateFeaturesMd } from './tdd-automation/core/features-parser'
import {
  calculateSpecPriority,
  reloadGeneratedConfig,
} from './tdd-automation/core/schema-priority-calculator'


interface SpecTest {
  id: string | null
  name: string
  tag: '@spec' | '@regression' | null
  domain: string | null
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
  duplicateSpecIds: DuplicateSpecId[]
  orphanedSpecIds: OrphanedSpecId[]
  tddAutomation: TDDAutomationStats
  tddQueue: TDDQueueItem[]
  userStoryMetrics: UserStoryMetrics | null
  schemaStructure: SchemaStructureResult | null
}

interface DeepStructureIssue {
  readonly schemaPath: string
  readonly fsPath: string
  readonly propertyName: string
  readonly expectedType: 'file' | 'folder'
  readonly actualType: 'file' | 'folder' | 'missing'
}

interface NameMirroringIssue {
  readonly schemaPath: string
  readonly fsPath: string
  readonly kind: 'orphan' | 'missing'
  readonly name: string
  readonly detail: string
}

interface USSpecMappingIssue {
  readonly usId: string
  readonly usFilePath: string
  readonly expectedSpecPath: string
  readonly actualSpecPath: string | null
  readonly kind:
    | 'missing-spec-file'
    | 'orphan-spec-file'
    | 'describe-missing-us-id'
    | 'test-missing-spec-id'
    | 'spec-id-not-in-ac'
    | 'ac-spec-id-not-in-file'
  readonly detail: string
}

interface USSpecMapping {
  readonly usId: string
  readonly usFilePath: string
  readonly usTitle: string
  readonly expectedSpecPath: string
  readonly specIds: readonly string[]
}

interface InternalComingSoonEntry {
  readonly schemaFile: string
  readonly effectSchemaNames: readonly string[]
  readonly linkedUserStories: readonly string[]
  readonly fixmeSpecIds: readonly string[]
  readonly reason: string
  readonly discriminatorTag?: string
  readonly parentSchemaName?: string
  readonly leafSchemaTags?: readonly (readonly [string, string])[]
}

interface InternalComingSoonManifest {
  readonly generatedAt: string
  readonly entries: readonly InternalComingSoonEntry[]
}

interface SchemaStructureResult {
  readonly appSchemaProperties: readonly string[]
  readonly folders: readonly string[]
  readonly simpleFileProperties: readonly string[]
  readonly missingFolders: readonly string[]
  readonly orphanFolders: readonly string[]
  readonly missingIndexFiles: readonly string[]
  readonly deepIssues: readonly DeepStructureIssue[]
  readonly nameMirroringIssues: readonly NameMirroringIssue[]
  readonly discriminatedUnions: readonly DiscriminatedUnionInfo[]
  readonly variantCoverageIssues: readonly VariantCoverageIssue[]
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

interface TDDQueueItem {
  specId: string
  description: string
  file: string
  line: number
  priority: number
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


interface AcceptanceCriterion {
  id: string
  criterion: string
  specTestId: string | null
  schema: string
  status: 'complete' | 'partial' | 'not-started'
}

interface UserStory {
  id: string
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
  storiesToSpecify: UserStory[]
  storiesToSpecifyPercent: number
  storiesSpecifiedNotImplemented: UserStory[]
  storiesSpecifiedNotImplementedPercent: number
  storiesSpecifiedAndImplemented: UserStory[]
  storiesSpecifiedAndImplementedPercent: number
  byDomain: Map<string, UserStory[]>
}

interface OrphanedSpecId {
  specId: string
  file: string
  line: number
  testName: string
}


const SPEC_ID_PATTERN = /^([A-Z]+-[A-Z0-9-]+-(?:\d{3}|REGRESSION(?:-\d+)?))/
const GIVEN_PATTERN = /\/\/\s*GIVEN/i
const WHEN_PATTERN = /\/\/\s*(WHEN|GIVEN\/WHEN|WHEN\/THEN)/i
const THEN_PATTERN = /\/\/\s*(THEN|WHEN\/THEN)/i
const IMPLICIT_THEN_PATTERN = /\.\s*(rejects|resolves)\s*\.\s*(toThrow|toBe|toEqual|toMatch)/
const TEST_PATTERN = /test\s*\(\s*['"`]([^'"`]+)['"`]/g
const TEST_FIXME_PATTERN = /test\.fixme\s*\(\s*['"`]([^'"`]+)['"`]/g
const DESCRIBE_PATTERN = /test\.describe\s*\(\s*['"`]([^'"`]+)['"`]/
const TAG_PATTERN =
  /\{\s*tag:\s*(?:['"`](@spec|@regression)['"`]|\[['"`](@spec|@regression)['"`](?:,\s*['"`]@domain:[^'"`]+['"`])*\])\s*\}/
const DOMAIN_TAG_PATTERN = /@domain:([a-z][-a-z]*)/
const TODO_PATTERN = /\/\/\s*TODO[:\s](.+?)(?:\n|$)/gi

function isRegressionSpecId(specId: string): boolean {
  return /-REGRESSION(?:-\d+)?$/.test(specId)
}

const SPECS_DIR = join(process.cwd(), 'specs')
const OUTPUT_FILE = join(process.cwd(), 'SPEC-PROGRESS.md')
const WARNINGS_FILE = join(process.cwd(), 'SPEC-WARNINGS.md')
const COMING_SOON_INTERNAL_FILE = join(process.cwd(), 'schemas/.coming-soon.internal.json')
const COMING_SOON_REGISTRY_FILE = join(
  process.cwd(),
  'src/infrastructure/coming-soon/registry.generated.ts'
)
const OLD_OUTPUT_FILE = join(process.cwd(), 'SPEC-STATE.md')
const README_FILE = join(process.cwd(), 'README.md')
const USER_STORIES_DIR = join(process.cwd(), 'docs/user-stories')
const SCHEMA_MODEL_DIRS = ['src/domain/models/app', 'src/domain/models/api']
const FILE_HEADER_SCHEMA_PATTERN = /^>\s*\*\*Schema\*\*:\s*(.+)/m
const FILE_HEADER_API_ROUTES_PATTERN = /^>\s*\*\*API Routes\*\*:\s*(.+)/m
const API_ROUTE_ENTRY_PATTERN = /`(GET|POST|PUT|PATCH|DELETE)\s+\/api\/([^`]+)`/g
const API_SCHEMA_EXEMPT_DIRS = new Set(['_shared'])
const API_ROUTE_ROOT_SPECIAL = new Set(['openapi.json', 'scalar'])
const API_ROUTE_ACTION_SEGMENTS = new Set([
  'batch',
  'upsert',
  'restore',
  'replay',
  'cancel',
  'sse',
  'subscribe',
  'rebuild',
  'send',
  'verify',
  'enable',
  'disable',
  'read',
  'dismiss',
  'test',
  'retry',
  'deliveries',
  'tools',
  'history',
  'overview',
  'pages',
  'referrers',
  'devices',
  'campaigns',
  'collect',
  'preferences',
  'trash',
  'admin',
  'email',
  'openapi',
])

const USER_STORY_STATUS_PATTERN = /\*\*Status\*\*:\s*`\[([x~\s])\]`/
const ACCEPTANCE_CRITERIA_TABLE_ROW_PATTERN =
  /^\|\s*`?([A-Z]+-[A-Z0-9-]+-(?:\d{3}|REGRESSION))`?\s*\|\s*([^|]+)\s*\|(?:\s*[^|]*\s*\|)?$/gm
const FEATURE_AREA_PATTERN = />\s*\*\*Feature Area\*\*:\s*(\S+)/
const ROLE_PATTERN = />\s*\*\*Role\*\*:\s*(.+)/


interface StoryValidationIssue {
  readonly file: string
  readonly severity: 'error' | 'warning' | 'info'
  readonly message: string
  readonly line?: number
  readonly code?: string
}

type PropertyCoverageLevel = 'full' | 'partial' | 'none'

interface PropertyCoverageEntry {
  readonly path: string
  readonly topLevelDomain: string
  readonly isLeaf: boolean
  readonly isRecord: boolean
  readonly hasYamlExample: boolean
  readonly hasAcCoverage: boolean
  readonly hasSchemaRef: boolean
  readonly coverageLevel: PropertyCoverageLevel
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

const US_HEADING_PATTERN = /^## (US-[\w-]+):\s*(.+)/
const AC_ROW_PATTERN = /^\|\s*`?([A-Z]+-[A-Z0-9-]+-(?:\d{3}|REGRESSION))`?\s*\|/
const IMPL_SCHEMA_PATTERN = /\*\*(?:API )?Schema\*\*:\s*`([^`]+)`/
const IMPL_SPEC_PATTERN = /\*\*E2E Spec\*\*:\s*`([^`]+)`/
const USER_STORIES_RELATIVE_DIR = 'docs/user-stories'

const ALLOWED_SPEC_PREFIXES = ['APP-', 'API-', 'CLI-', 'MIGRATION-', 'ADMIN-', 'STATIC-'] as const
const AC_HIGH_CAP = 30
const AC_EXTREME_CAP = 50
const AC_LOW_FLOOR = 1
const PATH_ABBREVIATIONS: Record<string, string> = {
  authentication: 'AUTH',
  internationalization: 'I18N',
  'user-management': 'USER-MGMT',
  'activity-monitoring': 'ACTIVITY',
}


function parseStorySection(
  file: string,
  id: string,
  title: string,
  lineNumber: number,
  lines: readonly string[],
  issues: StoryValidationIssue[]
): UserStorySection {
  const content = lines.join('\n')

  if (!/^US-[A-Z][A-Z0-9][\w-]*$/.test(id)) {
    issues.push({
      file,
      severity: 'warning',
      message: `US ID "${id}" does not follow US-{TAXONOMY} or US-{TAXONOMY}-{NNN} pattern`,
      line: lineNumber,
    })
  }

  const hasAsA = /\*\*As a\*\*/.test(content)
  const hasIWantTo = /\*\*I want to\*\*/.test(content)
  const hasSoThat = /\*\*so that\*\*/.test(content)

  if (!hasAsA)
    issues.push({
      file,
      severity: 'warning',
      message: `${id}: Missing "**As a**" phrase`,
      line: lineNumber,
    })
  if (!hasIWantTo)
    issues.push({
      file,
      severity: 'warning',
      message: `${id}: Missing "**I want to**" phrase`,
      line: lineNumber,
    })
  if (!hasSoThat)
    issues.push({
      file,
      severity: 'warning',
      message: `${id}: Missing "**so that**" phrase`,
      line: lineNumber,
    })

  const hasAcceptanceCriteria = /### Acceptance Criteria/.test(content)
  if (!hasAcceptanceCriteria)
    issues.push({
      file,
      severity: 'warning',
      message: `${id}: Missing ### Acceptance Criteria section`,
      line: lineNumber,
    })

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
      if (!acTableHeaderSeen && /^\|.*Spec.*ID.*\|/.test(line)) {
        const columns = line.split('|').filter((c) => c.trim().length > 0)
        if (columns.length !== 3)
          issues.push({
            file,
            severity: 'warning',
            message: `${id}: AC table header has ${columns.length} columns, expected 3`,
          })
        continue
      }
      const acMatch = AC_ROW_PATTERN.exec(line)
      if (acMatch?.[1]) {
        specIds.push(acMatch[1])
      }
    }
  }

  if (hasAcceptanceCriteria && specIds.length === 0)
    issues.push({ file, severity: 'info', message: `${id}: Acceptance Criteria table is empty` })

  const seenSpecIds = new Set<string>()
  for (const specId of specIds) {
    if (seenSpecIds.has(specId))
      issues.push({ file, severity: 'error', message: `${id}: Duplicate Spec ID: ${specId}` })
    seenSpecIds.add(specId)
  }

  const hasImplementationReferences = /### Implementation References/.test(content)
  if (!hasImplementationReferences)
    issues.push({
      file,
      severity: 'warning',
      message: `${id}: Missing ### Implementation References section`,
      line: lineNumber,
    })

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
    specIds,
    schemaRefs,
    specFileRefs,
  }
}

function parseUserStoryFileForValidation(
  relativePath: string,
  content: string
): UserStoryFileValidation {
  const lines = content.split('\n')
  const issues: StoryValidationIssue[] = []

  const hasH1 = lines.some((line) => /^# .+/.test(line))
  if (!hasH1) issues.push({ file: relativePath, severity: 'warning', message: 'Missing H1 title' })

  const hasFeatureArea = lines.some((line) => />\s*\*\*Feature Area\*\*:/.test(line))
  if (!hasFeatureArea)
    issues.push({
      file: relativePath,
      severity: 'warning',
      message: 'Missing Feature Area metadata',
    })

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

  if (stories.length === 0 && !relativePath.endsWith('index.md'))
    issues.push({
      file: relativePath,
      severity: 'warning',
      message: 'No user story sections found',
    })

  const STORY_SOFT_CAP = 10
  if (stories.length > STORY_SOFT_CAP)
    issues.push({
      file: relativePath,
      severity: 'info',
      message: `File contains ${stories.length} user stories (soft cap: ${STORY_SOFT_CAP}). Consider splitting by config concern.`,
    })

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

async function parentDirExists(filePath: string): Promise<boolean> {
  try {
    await access(dirname(filePath))
    return true
  } catch {
    return false
  }
}

async function validateFileReferences(
  files: readonly UserStoryFileValidation[]
): Promise<StoryValidationIssue[]> {
  const issues: StoryValidationIssue[] = []
  for (const file of files) {
    for (const story of file.stories) {
      for (const schemaRef of story.schemaRefs) {
        const physicalPath = schemaRef.split('#')[0] ?? schemaRef
        try {
          await access(physicalPath)
        } catch {
          try {
            await access(physicalPath.replace(/\/$/, ''))
          } catch {
            const parentExists = await parentDirExists(physicalPath)
            const suffix = parentExists ? '' : ' (planned feature area)'
            issues.push({
              file: file.relativePath,
              severity: 'warning',
              message: `${story.id}: Schema path does not exist: ${schemaRef}${suffix}`,
            })
          }
        }
      }
    }
  }
  return issues
}



function generateAppJsonSchema(): object {
  return JSONSchema.make(AppSchema) as object
}

function extractValidPaths(
  schema: Record<string, unknown>,
  defs?: Record<string, unknown>,
  prefix?: string
): { paths: Set<string>; recordPaths: Set<string> } {
  const paths = new Set<string>()
  const recordPaths = new Set<string>()
  const resolvedDefs = defs ?? (schema['$defs'] as Record<string, unknown> | undefined)

  const resolve = (node: Record<string, unknown>): Record<string, unknown> => {
    const ref = node['$ref'] as string | undefined
    if (ref && resolvedDefs) {
      const defKey = ref.replace(/^#\/\$defs\//, '')
      return (resolvedDefs[defKey] as Record<string, unknown>) ?? node
    }
    return node
  }

  const expandingDefs = new Set<string>()

  const walk = (node: Record<string, unknown>, currentPrefix: string) => {
    const ref = node['$ref'] as string | undefined
    const defKey = ref?.replace(/^#\/\$defs\//, '')
    if (defKey) {
      if (expandingDefs.has(defKey)) return
      expandingDefs.add(defKey)
    }

    const resolved = resolve(node)

    if (resolved['$id'] === '/schemas/unknown' && currentPrefix) {
      recordPaths.add(currentPrefix)
      if (defKey) expandingDefs.delete(defKey)
      return
    }

    const props = resolved['properties'] as Record<string, unknown> | undefined
    if (props) {
      for (const key of Object.keys(props)) {
        const fullPath = currentPrefix ? `${currentPrefix}.${key}` : key
        paths.add(fullPath)
        walk(props[key] as Record<string, unknown>, fullPath)
      }
    }

    const hasPatternProps = resolved['patternProperties'] !== undefined
    const hasObjectAdditionalProps =
      resolved['additionalProperties'] !== undefined &&
      typeof resolved['additionalProperties'] === 'object'
    const hasNoNamedProps = !props || Object.keys(props).length === 0

    if ((hasPatternProps || hasObjectAdditionalProps) && hasNoNamedProps && currentPrefix) {
      recordPaths.add(currentPrefix)
    }

    const branches =
      (resolved['anyOf'] as Array<Record<string, unknown>> | undefined) ??
      (resolved['oneOf'] as Array<Record<string, unknown>> | undefined)
    if (branches) {
      for (const branch of branches) {
        walk(branch, currentPrefix)
      }
    }

    const items = resolved['items'] as Record<string, unknown> | undefined
    if (items) {
      walk(items, currentPrefix)
    }

    if (defKey) {
      expandingDefs.delete(defKey)
    }
  }

  walk(schema, prefix ?? '')
  return { paths, recordPaths }
}

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
      blockStart = i + 2
    } else if (inBlock && line.trim() === '```') {
      inBlock = false
      blocks.push({ yaml: blockLines.join('\n'), lineNumber: blockStart })
    } else if (inBlock) {
      blockLines.push(line)
    }
  }

  return blocks
}

function extractDotPaths(obj: unknown, prefix?: string): string[] {
  if (obj === null || typeof obj !== 'object') return []
  if (Array.isArray(obj)) {
    const pathSet = new Set<string>()
    for (const item of obj) {
      for (const p of extractDotPaths(item, prefix)) {
        pathSet.add(p)
      }
    }
    return [...pathSet]
  }
  const paths: string[] = []
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const fullPath = prefix ? `${prefix}.${key}` : key
    paths.push(fullPath)
    paths.push(...extractDotPaths((obj as Record<string, unknown>)[key], fullPath))
  }
  return paths
}

function findSimilarKey(invalidPath: string, validPaths: readonly string[]): string | null {
  const parts = invalidPath.split('.')
  const lastPart = parts[parts.length - 1] ?? ''
  const parentPath = parts.slice(0, -1).join('.')

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

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  if (a.length < b.length) {
    const tmp = a
    a = b
    b = tmp
  }

  const bLen = b.length
  const row = Array.from({ length: bLen + 1 }, (_, i) => i)

  for (let i = 0; i < a.length; i++) {
    let prev = i + 1
    for (let j = 0; j < bLen; j++) {
      const cost = a[i] === b[j] ? 0 : 1
      const val = Math.min(
        prev + 1,
        (row[j + 1] ?? 0) + 1,
        (row[j] ?? 0) + cost
      )
      row[j] = prev
      prev = val
    }
    row[bLen] = prev
  }

  return row[bLen] ?? 0
}

function extractAllSchemaPropertyNames(schema: Record<string, unknown>): Set<string> {
  const names = new Set<string>()

  function walk(node: unknown): void {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) return
    const obj = node as Record<string, unknown>

    const props = obj['properties'] as Record<string, unknown> | undefined
    if (props) {
      for (const key of Object.keys(props)) {
        names.add(key)
        walk(props[key])
      }
    }

    const defs = obj['$defs'] as Record<string, unknown> | undefined
    if (defs) {
      for (const def of Object.values(defs)) {
        walk(def)
      }
    }

    for (const keyword of ['anyOf', 'oneOf'] as const) {
      const branches = obj[keyword] as unknown[] | undefined
      if (branches) {
        for (const branch of branches) {
          walk(branch)
        }
      }
    }

    if (obj['items']) {
      walk(obj['items'])
    }

    if (obj['additionalProperties'] && typeof obj['additionalProperties'] === 'object') {
      walk(obj['additionalProperties'])
    }
  }

  walk(schema)
  return names
}

function extractAllKeys(obj: unknown): Set<string> {
  const keys = new Set<string>()

  function walk(node: unknown): void {
    if (node === null || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item)
      }
      return
    }
    for (const key of Object.keys(node as Record<string, unknown>)) {
      keys.add(key)
      walk((node as Record<string, unknown>)[key])
    }
  }

  walk(obj)
  return keys
}

function isPluralVariant(a: string, b: string): boolean {
  const lower_a = a.toLowerCase()
  const lower_b = b.toLowerCase()
  return lower_a + 's' === lower_b || lower_b + 's' === lower_a
}

function validateYamlKeyTypos(
  files: readonly UserStoryFileValidation[],
  schemaPropertyNames: Set<string>,
  topLevelKeys: Set<string>
): StoryValidationIssue[] {
  const issues: StoryValidationIssue[] = []
  const schemaNames = [...schemaPropertyNames]

  for (const file of files) {
    const content = file.rawContent
    if (!content) continue

    const yamlBlocks = extractYamlConfigBlocks(content)

    for (const block of yamlBlocks) {
      let parsed: unknown
      try {
        parsed = Bun.YAML.parse(block.yaml)
      } catch {
        continue
      }

      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) continue

      const rootKeys = Object.keys(parsed as Record<string, unknown>)
      const isAppConfig = rootKeys.some((k) => topLevelKeys.has(k))
      if (!isAppConfig) continue

      const yamlKeys = extractAllKeys(parsed)

      for (const key of yamlKeys) {
        if (schemaPropertyNames.has(key) || key.length < 5) continue

        let bestDistance = Infinity
        let bestMatch = ''
        for (const schemaName of schemaNames) {
          if (Math.abs(key.length - schemaName.length) > 1) continue
          const dist = levenshteinDistance(key, schemaName)
          if (dist < bestDistance) {
            bestDistance = dist
            bestMatch = schemaName
          }
        }

        if (bestDistance === 1 && !isPluralVariant(key, bestMatch)) {
          issues.push({
            file: file.relativePath,
            severity: 'error',
            message: `YAML key "${key}" looks like a typo for "${bestMatch}" (edit distance: 1)`,
            line: block.lineNumber,
          })
        }
      }
    }
  }

  return issues
}

function validateYamlConfigCoherence(
  files: readonly UserStoryFileValidation[],
  validPaths: Set<string>,
  recordPaths: Set<string>,
  topLevelKeys: Set<string>
): StoryValidationIssue[] {
  const issues: StoryValidationIssue[] = []
  const validPathsArray = [...validPaths]

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
        parsed = Bun.YAML.parse(block.yaml)
      } catch {
        continue
      }

      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) continue

      const rootKeys = Object.keys(parsed as Record<string, unknown>)
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
      if (!/^(POST|GET|PUT|PATCH|DELETE|HEAD|OPTIONS)\s/i.test(text)) {
        blocks.push({ json: text, lineNumber: blockStart })
      }
    } else if (inBlock) {
      blockLines.push(line)
    }
  }

  return blocks
}

function buildApiSchemaRegistry(): Map<string, { schema: unknown; keys: Set<string> }> {
  const registry = new Map<string, { schema: unknown; keys: Set<string> }>()

  for (const [name, value] of Object.entries(apiSchemas)) {
    const v = value as unknown as Record<string, unknown>
    if (
      v &&
      typeof v === 'object' &&
      'safeParse' in v &&
      typeof v.safeParse === 'function' &&
      name.endsWith('Schema')
    ) {
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

function getSchemaCodeLiterals(schema: unknown): Set<string> | null {
  const s = schema as { shape?: Record<string, unknown> } | undefined
  const codeField = s?.shape?.['code'] as
    | { _def?: { type?: string; values?: unknown; entries?: unknown } }
    | undefined
  if (!codeField || !codeField._def) return null

  const def = codeField._def
  if (def.type === 'literal' && Array.isArray(def.values)) {
    const literals = (def.values as unknown[]).filter((v): v is string => typeof v === 'string')
    return literals.length > 0 ? new Set(literals) : null
  }
  if (def.type === 'enum' && def.entries && typeof def.entries === 'object') {
    const literals = Object.values(def.entries as Record<string, unknown>).filter(
      (v): v is string => typeof v === 'string'
    )
    return literals.length > 0 ? new Set(literals) : null
  }
  return null
}

function findMatchingApiSchema(
  jsonObj: Record<string, unknown>,
  registry: Map<string, { schema: unknown; keys: Set<string> }>
): { name: string; schema: unknown } | null {
  const objKeys = new Set(Object.keys(jsonObj))
  if (objKeys.size === 0) return null

  const codeValue = jsonObj['code']
  if (typeof codeValue === 'string') {
    const candidates: Array<{ name: string; schema: unknown; keys: Set<string> }> = []
    for (const [name, entry] of registry) {
      const literals = getSchemaCodeLiterals(entry.schema)
      if (literals && literals.has(codeValue)) {
        candidates.push({ name, ...entry })
      }
    }
    if (candidates.length === 1) {
      const only = candidates[0]
      if (only) return { name: only.name, schema: only.schema }
    }
    if (candidates.length > 1) {
      const candidatesWithRequired = candidates.map((c) => {
        const shape = (c.schema as { shape?: Record<string, unknown> }).shape ?? {}
        const requiredKeys: string[] = []
        for (const [k, v] of Object.entries(shape)) {
          const fieldDef = (v as { _def?: { type?: string } } | undefined)?._def
          if (fieldDef?.type !== 'optional') requiredKeys.push(k)
        }
        return { ...c, requiredKeys }
      })
      const fitsRequired = candidatesWithRequired.filter((c) =>
        c.requiredKeys.every((k) => objKeys.has(k))
      )
      if (fitsRequired.length > 0) {
        const winner = fitsRequired.reduce((best, c) =>
          c.requiredKeys.length > best.requiredKeys.length ? c : best
        )
        return { name: winner.name, schema: winner.schema }
      }
    }
  }

  let bestMatch: { name: string; schema: unknown } | null = null
  let bestScore = 0

  for (const [name, { schema, keys }] of registry) {
    if (keys.size === 0) continue
    const intersection = [...objKeys].filter((k) => keys.has(k)).length
    const union = new Set([...objKeys, ...keys]).size
    const score = intersection / union

    if (score > bestScore && score >= 0.5) {
      bestScore = score
      bestMatch = { name, schema }
    }
  }

  return bestMatch
}

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
        continue
      }

      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) continue

      const match = findMatchingApiSchema(parsed as Record<string, unknown>, registry)
      if (!match) continue

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
          severity: 'error',
          message: `JSON block does not match ${match.name}: ${errorSummary}`,
          line: block.lineNumber,
        })
      }

      if (result.success) {
        const matchEntry = registry.get(match.name)
        if (matchEntry) {
          const extraKeys = Object.keys(parsed as Record<string, unknown>).filter(
            (k) => !matchEntry.keys.has(k)
          )
          if (extraKeys.length > 0) {
            issues.push({
              file: file.relativePath,
              severity: 'warning',
              message: `JSON block has keys not in matched schema ${match.name}: ${extraKeys.join(', ')}`,
              line: block.lineNumber,
            })
          }
        }
      }
    }
  }

  return issues
}

function validateSchemaCoherence(
  files: readonly UserStoryFileValidation[]
): StoryValidationIssue[] {
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

  const schemaPropertyNames = extractAllSchemaPropertyNames(jsonSchema)
  const typoIssues = validateYamlKeyTypos(files, schemaPropertyNames, topLevelKeys)

  const apiRegistry = buildApiSchemaRegistry()
  const jsonIssues = validateJsonResponseCoherence(files, apiRegistry)

  return [...yamlIssues, ...typoIssues, ...jsonIssues]
}


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
    }
  }

  for (const dir of SCHEMA_MODEL_DIRS) {
    await walk(dir)
  }
  return files.sort()
}

function collectAllSchemaRefs(files: readonly UserStoryFileValidation[]): Set<string> {
  const refs = new Set<string>()

  for (const file of files) {
    const headerMatch = FILE_HEADER_SCHEMA_PATTERN.exec(file.rawContent)
    if (headerMatch?.[1]) {
      const backtickRefs = headerMatch[1].matchAll(/`([^`]+)`/g)
      for (const m of backtickRefs) {
        if (m[1]) refs.add(m[1])
      }
    }

    for (const story of file.stories) {
      for (const ref of story.schemaRefs) {
        refs.add(ref)
      }
    }
  }

  return refs
}

async function resolveBarrelSchemaExports(
  schemaFile: string,
  projectRoot: string,
  visited: Set<string> = new Set(),
  maxDepth = 4
): Promise<readonly string[]> {
  if (visited.has(schemaFile) || visited.size >= maxDepth) return []
  const localVisited = new Set([...visited, schemaFile])
  const absPath = join(projectRoot, schemaFile)
  let body: string
  try {
    body = await readFile(absPath, 'utf-8')
  } catch {
    return []
  }
  const direct = [...body.matchAll(SCHEMA_EXPORT_PATTERN)]
    .map((m) => m[1])
    .filter((n): n is string => typeof n === 'string')
  if (direct.length > 0) return direct

  const reexportPaths = new Set<string>()
  const starRe = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g
  for (const m of body.matchAll(starRe)) {
    if (m[1]) reexportPaths.add(m[1])
  }
  const namedRe = /export\s+\{[^}]*\}\s+from\s+['"]([^'"]+)['"]/g
  for (const m of body.matchAll(namedRe)) {
    if (m[1]) reexportPaths.add(m[1])
  }
  if (reexportPaths.size === 0) return []

  const dir = schemaFile.split('/').slice(0, -1).join('/')
  const allResolved: string[] = []
  for (const rel of reexportPaths) {
    if (!rel.startsWith('.')) continue
    const segments = rel.split('/')
    const resolvedDir = (() => {
      const parts = dir.split('/')
      for (const seg of segments.slice(0, -1)) {
        if (seg === '..') parts.pop()
        else if (seg !== '.') parts.push(seg)
      }
      const last = segments[segments.length - 1]
      if (last !== undefined && last !== '.' && last !== '..') parts.push(last)
      return parts.join('/')
    })()
    const candidates = [`${resolvedDir}.ts`, `${resolvedDir}/index.ts`, `${resolvedDir}/schema.ts`]
    for (const cand of candidates) {
      try {
        await access(join(projectRoot, cand))
      } catch {
        continue
      }
      const nested = await resolveBarrelSchemaExports(cand, projectRoot, localVisited, maxDepth)
      allResolved.push(...nested)
      break
    }
  }
  return [...new Set(allResolved)]
}

const SCHEMA_EXPORT_PATTERN =
  /export\s+const\s+(\w+Schema)(?:\s*:\s*[^=]+)?\s*=\s*(?:Schema\.|pipe\(|[A-Z]\w*Schema)/g

const aggregateKey = (schemaFile: string, tag: string | null): string =>
  tag === null ? schemaFile : `${schemaFile}#${tag}`

function parseSchemaRef(ref: string): { readonly schemaFile: string; readonly tag: string | null } {
  const hashIndex = ref.indexOf('#')
  if (hashIndex === -1) return { schemaFile: ref, tag: null }
  return {
    schemaFile: ref.slice(0, hashIndex),
    tag: ref.slice(hashIndex + 1) || null,
  }
}

function resolveParentSchemaName(source: string, tag: string): string | null {
  const literalNeedle = new RegExp(
    `Schema\\.Literal\\(\\s*['"]${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\s*\\)`
  )

  const sliceParenBody = (openIdx: number): string | null => {
    let depth = 0
    for (let i = openIdx; i < source.length; i++) {
      const ch = source[i]
      if (ch === '(') depth++
      else if (ch === ')') {
        depth--
        if (depth === 0) return source.slice(openIdx, i + 1)
      }
    }
    return null
  }

  const unionPattern = /export\s+const\s+(\w+Schema)\s*=\s*Schema\.(?:Union|TaggedUnion)\(/g
  const directHits: string[] = []
  let match: RegExpExecArray | null
  while ((match = unionPattern.exec(source)) !== null) {
    const name = match[1]
    if (!name) continue
    const openIdx = match.index + match[0].length - 1
    const unionBody = sliceParenBody(openIdx)
    if (unionBody === null) continue

    if (literalNeedle.test(unionBody)) {
      directHits.push(name)
      continue
    }
    const memberPattern = /\b(\w+Schema)\b/g
    let memberMatch: RegExpExecArray | null
    while ((memberMatch = memberPattern.exec(unionBody)) !== null) {
      const memberName = memberMatch[1]
      if (!memberName || memberName === name) continue
      const declPattern = new RegExp(
        `export\\s+const\\s+${memberName}\\s*=\\s*[\\s\\S]*?(?=^export|\\Z)`,
        'm'
      )
      const decl = source.match(declPattern)
      if (decl && literalNeedle.test(decl[0])) {
        directHits.push(name)
        break
      }
    }
  }
  if (directHits.length > 0) return directHits[0] ?? null

  const factoryPattern = /export\s+const\s+(\w+Schema)(?:\s*:\s*[^=]+)?\s*=\s*build\w*Union\(/g
  const factoryHits: string[] = []
  while ((match = factoryPattern.exec(source)) !== null) {
    const name = match[1]
    if (name) factoryHits.push(name)
  }
  if (factoryHits.length > 0) return factoryHits[0] ?? null

  return null
}

async function buildInternalComingSoonManifest(
  parsedFiles: readonly UserStoryFileValidation[],
  fixmeSpecIds: ReadonlySet<string>,
  passingSpecIds: ReadonlySet<string>
): Promise<InternalComingSoonManifest> {
  interface Aggregate {
    readonly schemaFile: string
    readonly tag: string | null
    readonly linkedUserStories: Set<string>
    readonly specIds: Set<string>
  }

  const byKey = new Map<string, Aggregate>()

  const recordRef = (
    schemaFile: string,
    tag: string | null,
    usRelativePath: string,
    storySpecIds: readonly string[]
  ) => {
    const key = aggregateKey(schemaFile, tag)
    let agg = byKey.get(key)
    if (!agg) {
      agg = { schemaFile, tag, linkedUserStories: new Set(), specIds: new Set() }
      byKey.set(key, agg)
    }
    agg.linkedUserStories.add(`${USER_STORIES_RELATIVE_DIR}/${usRelativePath}`)
    for (const id of storySpecIds) {
      agg.specIds.add(id)
    }
  }

  for (const file of parsedFiles) {
    const fileSpecIds: string[] = file.stories.flatMap((s) => [...s.specIds])
    if (fileSpecIds.length === 0) continue

    const headerMatch = FILE_HEADER_SCHEMA_PATTERN.exec(file.rawContent)
    if (headerMatch?.[1]) {
      const backtickRefs = headerMatch[1].matchAll(/`([^`]+)`/g)
      for (const m of backtickRefs) {
        const ref = m[1]
        if (!ref) continue
        const { schemaFile, tag } = parseSchemaRef(ref)
        if (schemaFile.endsWith('.ts') && schemaFile.startsWith('src/domain/models/app/')) {
          recordRef(schemaFile, tag, file.relativePath, fileSpecIds)
        }
      }
    }

    for (const story of file.stories) {
      if (story.specIds.length === 0) continue
      for (const ref of story.schemaRefs) {
        const { schemaFile, tag } = parseSchemaRef(ref)
        if (schemaFile.endsWith('.ts') && schemaFile.startsWith('src/domain/models/app/')) {
          recordRef(schemaFile, tag, file.relativePath, story.specIds)
        }
      }
    }
  }

  const projectRoot = process.cwd()
  const sortedKeys = [...byKey.keys()].sort()
  const candidateEntries = sortedKeys.flatMap<Aggregate>((key) => {
    const agg = byKey.get(key)
    if (!agg) return []
    const ids = [...agg.specIds]
    const hasPassing = ids.some((id) => passingSpecIds.has(id))
    const hasFixme = ids.some((id) => fixmeSpecIds.has(id))
    if (hasPassing || !hasFixme) return []
    return [agg]
  })

  const sourceCache = new Map<string, string | null>()
  const readSource = async (schemaFile: string): Promise<string | null> => {
    if (sourceCache.has(schemaFile)) return sourceCache.get(schemaFile) ?? null
    let result: string | null
    try {
      result = await readFile(join(projectRoot, schemaFile), 'utf-8')
    } catch {
      result = null
    }
    sourceCache.set(schemaFile, result)
    return result
  }

  const projectModelsRoot = join(projectRoot, 'src/domain/models/app')
  const tagFileCount = new Map<string, Set<string>>()
  const collectModelFiles = async (dir: string): Promise<readonly string[]> => {
    const entries = await readdir(dir, { withFileTypes: true })
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) return collectModelFiles(full)
        if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts'))
          return [full]
        return []
      })
    )
    return nested.flat()
  }
  const allModelFiles = await collectModelFiles(projectModelsRoot)
  await Promise.all(
    allModelFiles.map(async (full) => {
      let body: string
      try {
        body = await readFile(full, 'utf-8')
      } catch {
        return
      }
      const callMatches = body.matchAll(/Schema\.Literal\((\s*['"][^)]*)\)/g)
      for (const m of callMatches) {
        const argList = m[1]
        if (typeof argList !== 'string') continue
        for (const argMatch of argList.matchAll(/['"]([^'"]+)['"]/g)) {
          const tag = argMatch[1]
          if (typeof tag !== 'string') continue
          const set = tagFileCount.get(tag) ?? new Set<string>()
          set.add(full)
          tagFileCount.set(tag, set)
        }
      }
    })
  )

  const entryResults = await Promise.all(
    candidateEntries.map(async (agg): Promise<InternalComingSoonEntry | null> => {
      const { schemaFile, tag } = agg
      const source = await readSource(schemaFile)
      if (source === null) {
        const tagSuffix = tag === null ? '' : `#${tag}`
        console.log(
          `[coming-soon] warning: ${schemaFile}${tagSuffix} could not be read — entry skipped`
        )
        return null
      }

      const fixmeSpecIdsForFile = [...agg.specIds].filter((id) => fixmeSpecIds.has(id)).sort()
      const linkedUserStories = [...agg.linkedUserStories].sort()
      const reason = `All ${fixmeSpecIdsForFile.length} linked spec(s) are .fixme()`

      if (tag === null) {
        const exportMatches = [...source.matchAll(SCHEMA_EXPORT_PATTERN)]
        let effectSchemaNames = exportMatches
          .map((m) => m[1])
          .filter((n): n is string => typeof n === 'string')
        if (effectSchemaNames.length === 0) {
          const fromBarrel = await resolveBarrelSchemaExports(schemaFile, projectRoot)
          if (fromBarrel.length > 0) {
            effectSchemaNames = [...fromBarrel]
          }
        }
        if (effectSchemaNames.length === 0) {
          console.log(`[coming-soon] warning: ${schemaFile} has no *Schema export — entry skipped`)
          return null
        }

        const primaryLiteralRegex =
          /\b(?:type|kind)\s*:\s*Schema\.Literal\(\s*['"]([^'"]+)['"]\s*\)/g
        const allLiteralMatches = [...source.matchAll(primaryLiteralRegex)]
        const tagToSchema = new Map<string, string>()
        const exportRanges = exportMatches
          .map((m) => {
            if (m.index === undefined || typeof m[1] !== 'string') return null
            return { name: m[1], start: m.index }
          })
          .filter((x): x is { name: string; start: number } => x !== null)
          .sort((a, b) => a.start - b.start)
        const absSchemaFile = join(projectRoot, schemaFile)
        for (const lm of allLiteralMatches) {
          const value = lm[1]
          if (typeof value !== 'string' || lm.index === undefined) continue
          if (tagToSchema.has(value)) continue
          const filesUsingTag = tagFileCount.get(value)
          if (!filesUsingTag) continue
          if (filesUsingTag.size !== 1) continue
          if (!filesUsingTag.has(absSchemaFile)) continue
          const owner = exportRanges.reduce<string | null>((acc, range) => {
            if (range.start <= lm.index!) return range.name
            return acc
          }, null)
          if (owner !== null) {
            tagToSchema.set(value, owner)
          }
        }
        const leafSchemaTags: readonly (readonly [string, string])[] = [...tagToSchema.entries()]
          .map(([t, s]) => [t, s] as const)
          .sort(([a], [b]) => a.localeCompare(b))

        return {
          schemaFile,
          effectSchemaNames,
          linkedUserStories,
          fixmeSpecIds: fixmeSpecIdsForFile,
          reason,
          ...(leafSchemaTags.length > 0 ? { leafSchemaTags } : {}),
        }
      }

      const parentSchemaName = resolveParentSchemaName(source, tag)
      if (parentSchemaName === null) {
        console.log(
          `[coming-soon] warning: ${schemaFile}#${tag} could not resolve parent schema — entry skipped`
        )
        return null
      }
      return {
        schemaFile,
        effectSchemaNames: [parentSchemaName],
        linkedUserStories,
        fixmeSpecIds: fixmeSpecIdsForFile,
        reason,
        discriminatorTag: tag,
        parentSchemaName,
      }
    })
  )

  const entries = entryResults.filter((e): e is InternalComingSoonEntry => e !== null)

  return {
    generatedAt: new Date().toISOString(),
    entries,
  }
}

function toRegistrySource(internal: InternalComingSoonManifest): string {
  const wholeFileNames = internal.entries
    .filter((e) => e.discriminatorTag === undefined)
    .flatMap((e) => [...e.effectSchemaNames])
  const sortedSchemaNames = [...new Set(wholeFileNames)].sort()
  const schemaLiterals = sortedSchemaNames.map((name) => `  '${name}',`).join('\n')
  const schemaSetBody = sortedSchemaNames.length === 0 ? '[]' : `[\n${schemaLiterals}\n]`

  const byParent = new Map<string, Set<string>>()
  for (const entry of internal.entries) {
    if (entry.discriminatorTag === undefined || entry.parentSchemaName === undefined) continue
    const tags = byParent.get(entry.parentSchemaName) ?? new Set<string>()
    tags.add(entry.discriminatorTag)
    byParent.set(entry.parentSchemaName, tags)
  }
  const sortedParents = [...byParent.keys()].sort()
  const discriminatorLines = sortedParents.map((parent) => {
    const tags = [...(byParent.get(parent) ?? new Set<string>())].sort()
    const tagLiterals = tags.map((t) => `'${t}'`).join(', ')
    return `  ['${parent}', new Set([${tagLiterals}])],`
  })
  const discriminatorBody =
    sortedParents.length === 0 ? '[]' : `[\n${discriminatorLines.join('\n')}\n]`

  const allTags = new Set<string>()
  for (const tags of byParent.values()) {
    for (const t of tags) allTags.add(t)
  }
  const sortedTags = [...allTags].sort()
  const tagLiterals = sortedTags.map((t) => `  '${t}',`).join('\n')
  const tagSetBody = sortedTags.length === 0 ? '[]' : `[\n${tagLiterals}\n]`

  const leafTagToSchema = new Map<string, string>()
  for (const entry of internal.entries) {
    if (entry.discriminatorTag !== undefined) continue
    if (!entry.leafSchemaTags) continue
    for (const [tag, schemaName] of entry.leafSchemaTags) {
      if (!leafTagToSchema.has(tag)) leafTagToSchema.set(tag, schemaName)
    }
  }
  const sortedLeafEntries = [...leafTagToSchema.entries()].sort(([a], [b]) => a.localeCompare(b))
  const leafLines = sortedLeafEntries.map(([tag, schemaName]) => `  ['${tag}', '${schemaName}'],`)
  const leafBody = leafLines.length === 0 ? '[]' : `[\n${leafLines.join('\n')}\n]`

  return `/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */
// GENERATED FILE — regenerated by \`bun run progress\`. DO NOT EDIT.

/**
 * Effect Schema names whose ENTIRE schema file is currently fixme-only.
 * Used by the runtime warner for whole-feature detection (no discriminated
 * variants involved). Example: \`AiTranslateFieldSchema\`.
 */
export const COMING_SOON_SCHEMA_NAMES: ReadonlySet<string> = new Set(${schemaSetBody})

/**
 * Map from parent union schema name to the set of discriminator tags
 * that are individually fixme. Used by the runtime warner to flag only
 * specific union variants (e.g. \`'kanban'\` inside \`PageComponentSchema\`)
 * without blanket-deprecating the parent type.
 */
export const COMING_SOON_DISCRIMINATORS: ReadonlyMap<string, ReadonlySet<string>> = new Map(${discriminatorBody})

/**
 * Flattened union of all coming-soon discriminator tags across parents.
 * Pre-computed for fast runtime lookup before scanning the parent map.
 */
export const COMING_SOON_TAGS: ReadonlySet<string> = new Set(${tagSetBody})

/**
 * Auto-derived map from \`Schema.Literal('xxx')\` discriminator value to
 * the specific \`*Schema\` (within \`COMING_SOON_SCHEMA_NAMES\`) that
 * declares it. Used by the runtime warner for whole-file detection — when
 * a runtime \`type: 'xxx'\` value isn't covered by
 * \`COMING_SOON_DISCRIMINATORS\`, this map provides the schema name for
 * the legacy whole-file warning format.
 *
 * Replaces the hand-curated \`TAG_TO_SCHEMA_NAME\` from earlier commits;
 * derived directly from the manifest so the mapping never drifts.
 */
export const COMING_SOON_LEAF_SCHEMA_TAGS: ReadonlyMap<string, string> = new Map(${leafBody})
`
}

function extractApiRouteStructure(
  files: readonly UserStoryFileValidation[]
): Map<string, Set<string>> {
  const structure = new Map<string, Set<string>>()

  for (const file of files) {
    const headerMatch = FILE_HEADER_API_ROUTES_PATTERN.exec(file.rawContent)
    if (!headerMatch?.[1]) continue

    const line = headerMatch[1]
    API_ROUTE_ENTRY_PATTERN.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = API_ROUTE_ENTRY_PATTERN.exec(line)) !== null) {
      const pathAfterApi = match[2]?.split('?')[0]
      if (!pathAfterApi) continue
      const segments = pathAfterApi.split('/')
      const domain = segments[0]
      if (!domain || API_ROUTE_ROOT_SPECIAL.has(domain) || domain.startsWith(':')) continue

      if (!structure.has(domain)) structure.set(domain, new Set())
      const subs = structure.get(domain)!

      for (let i = 1; i < segments.length; i++) {
        const seg = segments[i]
        if (
          seg &&
          !seg.startsWith(':') &&
          seg.length > 0 &&
          !seg.includes('-') &&
          !API_ROUTE_ACTION_SEGMENTS.has(seg)
        ) {
          subs.add(seg)
        }
      }
    }
  }

  return structure
}

function isSchemaFileCovered(schemaFile: string, refs: Set<string>): boolean {
  for (const ref of refs) {
    const physical = ref.split('#')[0] ?? ref
    if (physical.endsWith('.ts')) {
      if (schemaFile === physical) return true
    } else {
      const dirPrefix = physical.endsWith('/') ? physical : `${physical}/`
      if (schemaFile.startsWith(dirPrefix)) return true
    }
  }
  return false
}

async function validateApiSchemaDirectoryConvention(): Promise<readonly StoryValidationIssue[]> {
  const API_SCHEMA_DIR = 'src/domain/models/api'
  const EXEMPT_FILES = new Set(['index.ts'])
  const issues: StoryValidationIssue[] = []

  const dirPath = join(process.cwd(), API_SCHEMA_DIR)
  const entries = await readdir(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isDirectory()) continue
    if (EXEMPT_FILES.has(entry.name)) continue
    if (entry.name.endsWith('.test.ts')) continue

    if (entry.name.endsWith('.ts')) {
      const domain = entry.name.replace(/\.ts$/, '')
      issues.push({
        file: `${API_SCHEMA_DIR}/${entry.name}`,
        severity: 'warning',
        message: `API schema convention: "${entry.name}" should be in a subdirectory (e.g., "${API_SCHEMA_DIR}/${domain}/${entry.name}"). API schemas must be organized by route domain.`,
      })
    }
  }

  return issues
}

const API_SCHEMA_UTILITY_FILES = new Set(['params.ts', 'request.ts', 'common.ts', 'error.ts'])

async function validateApiSchemaStructure(
  files: readonly UserStoryFileValidation[]
): Promise<readonly StoryValidationIssue[]> {
  const apiSchemaDir = join(process.cwd(), 'src/domain/models/api')
  const issues: StoryValidationIssue[] = []

  const routeStructure = extractApiRouteStructure(files)
  const routeDomains = new Set(routeStructure.keys())

  const entries = await readdir(apiSchemaDir, { withFileTypes: true })
  const actualDirs = new Set(
    entries.filter((e) => e.isDirectory() && !API_SCHEMA_EXEMPT_DIRS.has(e.name)).map((e) => e.name)
  )

  for (const domain of routeDomains) {
    if (!actualDirs.has(domain)) {
      issues.push({
        file: 'src/domain/models/api/',
        severity: 'error',
        message: `API route domain "${domain}" (from user stories) has no matching directory src/domain/models/api/${domain}/`,
      })
    }
  }

  for (const dir of actualDirs) {
    if (!routeDomains.has(dir)) {
      issues.push({
        file: `src/domain/models/api/${dir}/`,
        severity: 'warning',
        message: `API schema directory "${dir}" does not correspond to any API route in user stories (orphan — add \`> **API Routes**:\` header to relevant US files)`,
      })
    }
  }

  for (const dir of actualDirs) {
    if (routeDomains.has(dir)) {
      try {
        await access(join(apiSchemaDir, dir, 'index.ts'))
      } catch {
        issues.push({
          file: `src/domain/models/api/${dir}/`,
          severity: 'error',
          message: `API schema directory "${dir}" is missing index.ts entry point`,
        })
      }
    }
  }

  for (const [domain, subResources] of routeStructure) {
    if (!actualDirs.has(domain)) continue

    const domainDir = join(apiSchemaDir, domain)
    const domainEntries = await readdir(domainDir, { withFileTypes: true })

    const schemaFiles = new Set<string>()
    for (const entry of domainEntries) {
      if (!entry.isFile() || !entry.name.endsWith('.ts')) continue
      if (entry.name === 'index.ts') continue
      if (entry.name.endsWith('.test.ts')) continue
      if (entry.name === `${domain}.ts`) continue
      if (API_SCHEMA_UTILITY_FILES.has(entry.name)) continue
      schemaFiles.add(entry.name.replace(/\.ts$/, ''))
    }

    if (subResources.size === 0 || schemaFiles.size === 0) continue

    for (const fileName of schemaFiles) {
      if (!subResources.has(fileName)) {
        issues.push({
          file: `src/domain/models/api/${domain}/${fileName}.ts`,
          severity: 'warning',
          message: `API schema file "${fileName}.ts" in ${domain}/ does not match any route sub-resource (routes have: ${[...subResources].join(', ')})`,
        })
      }
    }

    for (const sub of subResources) {
      if (!schemaFiles.has(sub)) {
        const hasDomainFile = domainEntries.some((e) => e.name === `${domain}.ts`)
        if (hasDomainFile && schemaFiles.size === 0) continue
        issues.push({
          file: `src/domain/models/api/${domain}/`,
          severity: 'warning',
          message: `API route sub-resource "${sub}" (from /api/${domain}/${sub}) has no matching schema file src/domain/models/api/${domain}/${sub}.ts`,
        })
      }
    }
  }

  return issues
}

async function validateSchemaLinking(
  files: readonly UserStoryFileValidation[]
): Promise<readonly StoryValidationIssue[]> {
  const schemaFiles = await discoverSchemaFiles()
  const refs = collectAllSchemaRefs(files)
  const issues: StoryValidationIssue[] = []

  const unlinked = schemaFiles.filter((f) => !isSchemaFileCovered(f, refs))

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


const APP_SCHEMA_DIR = join(process.cwd(), 'src/domain/models/app')
const SPEC_APP_DIR = join(process.cwd(), 'specs/app')
const US_PERSONA_PREFIXES = ['as-developer/', 'as-business-admin/', 'as-end-user/']


const SPEC_EXEMPT_DIRS = new Set(['__snapshots__', 'fixtures', 'containers', 'json-schema'])

function titleToSlug(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join('-')
    .toLowerCase()
}

const SPEC_PATH_REMAPS: ReadonlyArray<{ readonly from: string; readonly to: string }> = [
  { from: 'activity-monitoring/activity-logging', to: 'analytics/activity-logging' },
  { from: 'app-schema/', to: 'api/' },
  { from: 'analytics/page-analytics', to: 'analytics' },
  { from: 'notifications/notifications', to: 'notifications' },
  { from: 'internationalization/multi-language-apps', to: 'internationalization' },
  { from: 'pages/media/media-components', to: 'pages/media' },
  { from: 'pages/search/search', to: 'pages/search' },
]

const SPEC_FILE_OVERRIDES = new Map<string, string>([
  ['US-AI-AGENTS-DEFINITION-001', 'specs/ai/agents/definition.spec.ts'],
  ['US-AI-AGENTS-DEFINITION-002', 'specs/ai/agents/system-prompt.spec.ts'],
  ['US-AI-AGENTS-CROSS-CUTTING', 'specs/ai/agents/cross-cutting.spec.ts'],
  ['US-AUTOMATIONS-ACTIONS-DELAY-001', 'specs/automations/actions/delay.spec.ts'],
  [
    'US-AUTOMATIONS-ACTIONS-DELAY-QUEUE',
    'specs/automations/actions/delay/queue-delay-action.spec.ts',
  ],
  ['US-AUTOMATIONS-ACTIONS-FLOW', 'specs/automations/actions/flow/stop.spec.ts'],
  ['US-AUTOMATIONS-AUTOMATION-DEFINITIONS-001', 'specs/automations/automation-definitions.spec.ts'],
  [
    'US-AUTOMATIONS-AUTOMATION-DEFINITIONS-002',
    'specs/automations/concurrency/parallel-execution.spec.ts',
  ],
  ['US-PAGES-SOCIAL-AI-CHAT-003', 'specs/pages/social/ai-chat/chat-interaction.spec.ts'],
  ['US-PAGES-SOCIAL-AI-CHAT-004', 'specs/pages/social/ai-chat/chat-error-states.spec.ts'],
  [
    'US-USER-MGMT-ADMIN-INVITATION-FLOW',
    'specs/user-management/admin-user-management/invite-user.spec.ts',
  ],
])

function deriveExpectedSpecPath(
  usRelativePath: string,
  usSection: { readonly id: string; readonly title: string },
  storyCountInFile: number
): string {
  const override = SPEC_FILE_OVERRIDES.get(usSection.id)
  if (override) return override

  let stripped = usRelativePath
  for (const prefix of US_PERSONA_PREFIXES) {
    if (stripped.startsWith(prefix)) {
      stripped = stripped.slice(prefix.length)
      break
    }
  }

  for (const remap of SPEC_PATH_REMAPS) {
    if (stripped.startsWith(remap.from)) {
      stripped = remap.to + stripped.slice(remap.from.length)
      break
    }
  }

  const basePath = stripped.replace(/\.md$/, '')

  if (storyCountInFile <= 1) {
    return `specs/${basePath}.spec.ts`
  }

  const titlePart = usSection.title.replace(/^[^:]+:\s*/, '').trim()
  const slug = titleToSlug(titlePart) || 'unnamed'

  return `specs/${basePath}/${slug}.spec.ts`
}

function buildUSSpecMappings(
  parsedFiles: readonly UserStoryFileValidation[]
): readonly USSpecMapping[] {
  const mappings: USSpecMapping[] = []

  for (const file of parsedFiles) {
    if (file.stories.length === 0) continue

    for (const story of file.stories) {
      if (!story.id.startsWith('US-')) continue

      if (story.specIds.length === 0) continue

      mappings.push({
        usId: story.id,
        usFilePath: file.relativePath,
        usTitle: story.title,
        expectedSpecPath: deriveExpectedSpecPath(
          file.relativePath,
          { id: story.id, title: story.title },
          file.stories.length
        ),
        specIds: story.specIds,
      })
    }
  }

  return mappings
}

async function collectAllSpecFiles(dir: string): Promise<string[]> {
  const results: string[] = []
  const projectRoot = process.cwd()

  async function walk(d: string): Promise<void> {
    let entries: string[]
    try {
      entries = await readdir(d)
    } catch {
      return
    }

    for (const name of entries) {
      if (SPEC_EXEMPT_DIRS.has(name)) continue

      const fullPath = join(d, name)
      const entryStat = await stat(fullPath)

      if (entryStat.isDirectory()) {
        await walk(fullPath)
      } else if (name.endsWith('.spec.ts')) {
        results.push(relative(projectRoot, fullPath))
      }
    }
  }

  await walk(dir)
  return results
}

async function validateUSSpecMapping(
  mappings: readonly USSpecMapping[],
  allSpecFilePaths: readonly string[]
): Promise<readonly USSpecMappingIssue[]> {
  const issues: USSpecMappingIssue[] = []
  const expectedPaths = new Set(mappings.map((m) => m.expectedSpecPath))
  const projectRoot = process.cwd()

  for (const mapping of mappings) {
    const fullPath = join(projectRoot, mapping.expectedSpecPath)
    try {
      await stat(fullPath)
    } catch {
      issues.push({
        usId: mapping.usId,
        usFilePath: mapping.usFilePath,
        expectedSpecPath: mapping.expectedSpecPath,
        actualSpecPath: null,
        kind: 'missing-spec-file',
        detail: `${mapping.usId}: Expected spec not found: ${mapping.expectedSpecPath}`,
      })
    }
  }

  for (const specPath of allSpecFilePaths) {
    if (!expectedPaths.has(specPath)) {
      const parts = specPath.split('/')
      if (parts.length < 2 || parts[0] !== 'specs') continue
      if (parts.length === 2 && !parts[1]?.endsWith('.spec.ts')) continue

      issues.push({
        usId: '',
        usFilePath: '',
        expectedSpecPath: specPath,
        actualSpecPath: specPath,
        kind: 'orphan-spec-file',
        detail: `${specPath}: No matching US mapping (orphan)`,
      })
    }
  }

  for (const mapping of mappings) {
    const fullPath = join(projectRoot, mapping.expectedSpecPath)
    let content: string
    try {
      content = await readFile(fullPath, 'utf-8')
    } catch {
      continue
    }

    const describeMatch = content.match(DESCRIBE_PATTERN)
    const describeLabel = describeMatch?.[1]
    if (describeLabel && !describeLabel.startsWith(mapping.usId)) {
      issues.push({
        usId: mapping.usId,
        usFilePath: mapping.usFilePath,
        expectedSpecPath: mapping.expectedSpecPath,
        actualSpecPath: mapping.expectedSpecPath,
        kind: 'describe-missing-us-id',
        detail: `${mapping.usId}: test.describe() should start with "${mapping.usId}:" but found "${describeLabel.slice(0, 60)}"`,
      })
    }

    const testNames: string[] = []
    const testRegex = /test(?:\.fixme)?\s*\(\s*['"`]([^'"`]+)['"`]/g
    let testMatch
    while ((testMatch = testRegex.exec(content)) !== null) {
      if (testMatch[1]) testNames.push(testMatch[1])
    }

    for (const testName of testNames) {
      const specIdMatch = testName.match(SPEC_ID_PATTERN)
      if (!specIdMatch) {
        issues.push({
          usId: mapping.usId,
          usFilePath: mapping.usFilePath,
          expectedSpecPath: mapping.expectedSpecPath,
          actualSpecPath: mapping.expectedSpecPath,
          kind: 'test-missing-spec-id',
          detail: `${mapping.usId}: Test name missing spec ID prefix: "${testName.slice(0, 60)}"`,
        })
      }
    }

    const fileSpecIds = new Set<string>()
    for (const testName of testNames) {
      const specIdMatch = testName.match(SPEC_ID_PATTERN)
      if (specIdMatch?.[1]) {
        fileSpecIds.add(specIdMatch[1])
      }
    }

    for (const acSpecId of mapping.specIds) {
      const baseRegressionMatch = acSpecId.match(/^(.+-REGRESSION)$/)
      const satisfiedBySplitRegression =
        baseRegressionMatch !== null &&
        [...fileSpecIds].some((id) => id.startsWith(`${baseRegressionMatch[1]}-`))
      if (!fileSpecIds.has(acSpecId) && !satisfiedBySplitRegression) {
        issues.push({
          usId: mapping.usId,
          usFilePath: mapping.usFilePath,
          expectedSpecPath: mapping.expectedSpecPath,
          actualSpecPath: mapping.expectedSpecPath,
          kind: 'ac-spec-id-not-in-file',
          detail: `${mapping.usId}: AC spec ID "${acSpecId}" not found in ${mapping.expectedSpecPath}`,
        })
      }
    }

    const acSpecIdSet = new Set(mapping.specIds)
    for (const fileSpecId of fileSpecIds) {
      if (isRegressionSpecId(fileSpecId)) continue
      if (!acSpecIdSet.has(fileSpecId)) {
        issues.push({
          usId: mapping.usId,
          usFilePath: mapping.usFilePath,
          expectedSpecPath: mapping.expectedSpecPath,
          actualSpecPath: mapping.expectedSpecPath,
          kind: 'spec-id-not-in-ac',
          detail: `${mapping.usId}: Spec ID "${fileSpecId}" in file but not in AC table of ${mapping.usFilePath}`,
        })
      }
    }
  }

  return issues
}


interface DiscriminatedUnionInfo {
  readonly schemaPath: string
  readonly discriminator: string
  readonly variants: readonly string[]
  readonly modelDir: string
  readonly specDir: string
}

interface VariantCoverageIssue {
  readonly variant: string
  readonly expectedSpecFile: string
  readonly detail: string
}

function detectDiscriminator(
  branches: readonly Record<string, unknown>[],
  defs: Record<string, unknown>
): { discriminator: string; values: readonly string[] } | null {
  for (const candidate of ['type', 'operator', 'kind']) {
    const values: string[] = []
    let allHaveConst = true

    for (const branch of branches) {
      const resolved = resolveSchemaRef(branch, defs)
      const props = resolved['properties'] as Record<string, Record<string, unknown>> | undefined
      if (!props) {
        allHaveConst = false
        break
      }

      const discProp = props[candidate]
      if (!discProp) {
        allHaveConst = false
        break
      }

      const constVal = discProp['const'] as string | undefined
      const enumVal = (discProp['enum'] as string[] | undefined)?.[0]
      const discriminatorValue = constVal ?? enumVal
      if (!discriminatorValue) {
        allHaveConst = false
        break
      }

      values.push(discriminatorValue)
    }

    if (allHaveConst && values.length > 0) {
      if (candidate === 'type') {
        const uniqueTypes = [...new Set(values)]
        return { discriminator: candidate, values: uniqueTypes }
      }
      return { discriminator: candidate, values }
    }
  }

  return null
}

function findDiscriminatedUnions(
  nodeSchema: Record<string, unknown>,
  defs: Record<string, unknown>,
  schemaPrefix: string,
  modelBaseDir: string,
  specBaseDir: string,
  results: DiscriminatedUnionInfo[],
  expandingDefs: Set<string>,
  depth = 0
): void {
  if (depth > 8) return

  const ref = nodeSchema['$ref'] as string | undefined
  const defKey = ref?.replace(/^#\/\$defs\//, '')
  if (defKey) {
    if (expandingDefs.has(defKey)) return
    expandingDefs.add(defKey)
  }

  const resolved = resolveSchemaRef(nodeSchema, defs)
  const properties = resolved['properties'] as Record<string, Record<string, unknown>> | undefined

  if (properties) {
    for (const [propName, propSchema] of Object.entries(properties)) {
      const kebabName = camelToKebab(propName)
      const childModelDir = join(modelBaseDir, kebabName)
      const childSpecDir = join(specBaseDir, kebabName)
      const childPrefix = schemaPrefix ? `${schemaPrefix}.${propName}` : propName

      const propResolved = resolveSchemaRef(propSchema, defs)

      if (propResolved['type'] === 'array' || propResolved['items']) {
        const items = propResolved['items'] as Record<string, unknown> | undefined
        if (items) {
          const itemRef = resolveSchemaRef(items, defs)
          const branches = (itemRef['anyOf'] ?? itemRef['oneOf']) as
            | Record<string, unknown>[]
            | undefined

          if (branches) {
            const disc = detectDiscriminator(branches, defs)
            if (disc) {
              results.push({
                schemaPath: childPrefix,
                discriminator: disc.discriminator,
                variants: disc.values,
                modelDir: childModelDir,
                specDir: childSpecDir,
              })
            }
          }

          const itemRefKey = (items['$ref'] as string | undefined)?.replace(/^#\/\$defs\//, '')
          if (itemRefKey && !expandingDefs.has(itemRefKey)) {
            expandingDefs.add(itemRefKey)
            const itemResolved = resolveSchemaDeep(items, defs)
            if (itemResolved['properties']) {
              findDiscriminatedUnions(
                itemResolved,
                defs,
                childPrefix,
                childModelDir,
                childSpecDir,
                results,
                expandingDefs,
                depth + 1
              )
            }
            expandingDefs.delete(itemRefKey)
          } else if (!itemRefKey) {
            const itemResolved = resolveSchemaDeep(items, defs)
            if (itemResolved['properties']) {
              findDiscriminatedUnions(
                itemResolved,
                defs,
                childPrefix,
                childModelDir,
                childSpecDir,
                results,
                expandingDefs,
                depth + 1
              )
            }
          }
        }
      }

      const directBranches = (propResolved['anyOf'] ?? propResolved['oneOf']) as
        | Record<string, unknown>[]
        | undefined
      if (directBranches) {
        const disc = detectDiscriminator(directBranches, defs)
        if (disc) {
          results.push({
            schemaPath: childPrefix,
            discriminator: disc.discriminator,
            variants: disc.values,
            modelDir: childModelDir,
            specDir: childSpecDir,
          })
        }
      }

      if (!directBranches) {
        const propRef = propSchema['$ref'] as string | undefined
        const propDefKey = propRef?.replace(/^#\/\$defs\//, '')
        if (propDefKey && expandingDefs.has(propDefKey)) continue
        if (propDefKey) expandingDefs.add(propDefKey)

        const deepResolved = resolveSchemaDeep(propSchema, defs)
        if (deepResolved['properties']) {
          findDiscriminatedUnions(
            deepResolved,
            defs,
            childPrefix,
            childModelDir,
            childSpecDir,
            results,
            expandingDefs,
            depth + 1
          )
        }

        if (propDefKey) expandingDefs.delete(propDefKey)
      }
    }
  }

  if (defKey) {
    expandingDefs.delete(defKey)
  }
}

async function validateVariantCoverage(
  unions: readonly DiscriminatedUnionInfo[],
  issues: VariantCoverageIssue[]
): Promise<void> {
  for (const union of unions) {
    let specFiles: string[]
    try {
      specFiles = await readdir(union.specDir)
    } catch {
      continue
    }

    const specBaseNames = new Set(
      specFiles
        .filter((f) => f.endsWith('.spec.ts'))
        .map((f) => {
          let base = f.replace(/\.spec\.ts$/, '')
          base = base.replace(/-(field|trigger|action|strategy|connection)$/, '')
          return base
        })
    )

    const specFullNames = new Set(
      specFiles.filter((f) => f.endsWith('.spec.ts')).map((f) => f.replace(/\.spec\.ts$/, ''))
    )

    for (const variant of union.variants) {
      const kebabVariant = camelToKebab(variant)

      const hasMatch =
        specBaseNames.has(kebabVariant) ||
        specFullNames.has(kebabVariant) ||
        specFullNames.has(`${kebabVariant}-field`) ||
        specFullNames.has(`${kebabVariant}-trigger`) ||
        specFullNames.has(`${kebabVariant}-action`) ||
        specFullNames.has(`${kebabVariant}-strategy`)

      if (!hasMatch) {
        issues.push({
          variant,
          expectedSpecFile: `specs/app/${relative(join(process.cwd(), 'specs/app'), union.specDir)}/${kebabVariant}.spec.ts`,
          detail: `Union "${union.schemaPath}" variant "${variant}" has no spec file (expected: ${kebabVariant}.spec.ts)`,
        })
      }
    }
  }
}

function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

function resolveSchemaRef(
  schema: Record<string, unknown>,
  defs: Record<string, unknown>
): Record<string, unknown> {
  const ref = schema['$ref'] as string | undefined
  if (ref && defs) {
    const defKey = ref.replace(/^#\/\$defs\//, '')
    return (defs[defKey] as Record<string, unknown>) ?? schema
  }
  return schema
}

function resolveSchemaDeep(
  propSchema: Record<string, unknown>,
  defs: Record<string, unknown>
): Record<string, unknown> {
  const resolved = resolveSchemaRef(propSchema, defs)

  const union = (resolved['anyOf'] ?? resolved['oneOf']) as Record<string, unknown>[] | undefined
  if (union) {
    for (const variant of union) {
      const r = resolveSchemaRef(variant, defs)
      const variantType = r['type'] as string | undefined
      if (variantType === 'object' || variantType === 'array' || r['properties'] || r['items']) {
        return r
      }
      if (variantType && variantType !== 'null') {
        return r
      }
    }
    const first = union[0]
    if (first) {
      return resolveSchemaRef(first, defs)
    }
  }

  return resolved
}

function getEffectiveSchemaType(
  propSchema: Record<string, unknown>,
  defs: Record<string, unknown>
): 'object' | 'array' | 'simple' {
  const resolved = resolveSchemaDeep(propSchema, defs)

  if (resolved['type'] === 'array' || resolved['items']) {
    const items = resolved['items'] as Record<string, unknown> | undefined
    if (items) {
      const resolvedItems = resolveSchemaDeep(items, defs)
      if (resolvedItems['properties'] || resolvedItems['anyOf'] || resolvedItems['oneOf']) {
        return 'array'
      }
    }
    return 'simple'
  }

  if (resolved['type'] === 'object' || resolved['properties']) {
    if (resolved['properties']) return 'object'
    return 'simple'
  }

  return 'simple'
}

function isObjectUnionSchema(
  propSchema: Record<string, unknown>,
  defs: Record<string, unknown>
): boolean {
  const rawResolved = resolveSchemaRef(propSchema, defs)
  const rawUnion = (rawResolved['anyOf'] ?? rawResolved['oneOf']) as
    | Record<string, unknown>[]
    | undefined
  if (!rawUnion || rawUnion.length < 2) return false
  let objectCount = 0
  for (const v of rawUnion) {
    const rv = resolveSchemaRef(v as Record<string, unknown>, defs)
    if (rv['properties'] || rv['type'] === 'object') objectCount++
    if (objectCount >= 2) return true
  }
  return false
}

const INLINE_LEAF_THRESHOLD = 8

function isInlineableProperty(
  propSchema: Record<string, unknown>,
  defs: Record<string, unknown>
): boolean {
  const leafCount = countLeafProperties(propSchema, defs, 0)
  return leafCount >= 0 && leafCount < INLINE_LEAF_THRESHOLD
}

function countLeafProperties(
  propSchema: Record<string, unknown>,
  defs: Record<string, unknown>,
  depth: number
): number {
  if (depth > 4) return -1

  const resolved = resolveSchemaDeep(propSchema, defs)

  if (resolved['type'] === 'object' && !resolved['properties']) return 0

  if (resolved['type'] === 'array' || resolved['items']) {
    const items = resolved['items'] as Record<string, unknown> | undefined
    if (items) {
      const itemResolved = resolveSchemaDeep(items, defs)
      if (itemResolved['anyOf'] || itemResolved['oneOf']) return -1
      if (itemResolved['properties']) {
        return countLeafProperties(items as Record<string, unknown>, defs, depth + 1)
      }
    }
    return 0
  }

  const properties = resolved['properties'] as Record<string, Record<string, unknown>> | undefined
  if (!properties) return 0

  let total = 0
  for (const subSchema of Object.values(properties)) {
    const subType = getEffectiveSchemaType(subSchema, defs)
    if (subType === 'simple') {
      total++
    } else {
      const subCount = countLeafProperties(subSchema, defs, depth + 1)
      if (subCount < 0) return -1
      total += subCount
    }
    if (total >= INLINE_LEAF_THRESHOLD) return total
  }

  return total
}

async function validateDeepStructure(
  nodeSchema: Record<string, unknown>,
  fsDir: string,
  defs: Record<string, unknown>,
  schemaPrefix: string,
  issues: DeepStructureIssue[]
): Promise<void> {
  const properties = nodeSchema['properties'] as Record<string, Record<string, unknown>> | undefined
  if (!properties) return

  for (const [propName, propSchema] of Object.entries(properties)) {
    const effectiveType = getEffectiveSchemaType(propSchema, defs)
    if (effectiveType === 'simple') continue

    if (isInlineableProperty(propSchema, defs)) continue

    const kebabName = camelToKebab(propName)
    const schemaPath = schemaPrefix ? `${schemaPrefix}.${propName}` : propName
    const filePath = join(fsDir, `${kebabName}.ts`)
    const folderPath = join(fsDir, kebabName)

    const fileExists = await access(filePath)
      .then(() => true)
      .catch(() => false)
    const folderExists = await access(folderPath)
      .then(() => true)
      .catch(() => false)

    if (!fileExists && !folderExists) {
      const aliasPath = DEEP_STRUCTURE_SUBDIR_ALIASES.get(kebabName)
      const aliasExists = aliasPath
        ? await access(join(fsDir, aliasPath))
            .then(() => true)
            .catch(() => false)
        : false

      if (!aliasExists) {
        const crossRefDirs = CROSS_REFERENCE_DIRS.get(fsDir) ?? []
        let foundInCrossRef = false
        for (const altDir of crossRefDirs) {
          const altFile = await access(join(altDir, `${kebabName}.ts`))
            .then(() => true)
            .catch(() => false)
          const altFolder = await access(join(altDir, kebabName))
            .then(() => true)
            .catch(() => false)
          const altAlias = aliasPath
            ? await access(join(altDir, aliasPath))
                .then(() => true)
                .catch(() => false)
            : false
          if (altFile || altFolder || altAlias) {
            foundInCrossRef = true
            break
          }
        }

        if (!foundInCrossRef) {
          issues.push({
            schemaPath,
            fsPath: `src/domain/models/app/${relative(APP_SCHEMA_DIR, fsDir)}/`,
            propertyName: propName,
            expectedType: effectiveType === 'array' ? 'folder' : 'file',
            actualType: 'missing' as 'file' | 'folder',
          })
        }
      }
    }

    if (folderExists) {
      if (isObjectUnionSchema(propSchema, defs)) continue

      const resolved = resolveSchemaDeep(propSchema, defs)
      if (effectiveType === 'array') {
        const items = resolved['items'] as Record<string, unknown> | undefined
        if (items) {
          if (isObjectUnionSchema(items as Record<string, unknown>, defs)) continue
          const itemResolved = resolveSchemaDeep(items, defs)
          if (itemResolved['properties']) {
            await validateDeepStructure(itemResolved, folderPath, defs, schemaPath, issues)
          }
        }
      } else if (resolved['properties']) {
        await validateDeepStructure(resolved, folderPath, defs, schemaPath, issues)
      }
    }
  }
}

const DEEP_STRUCTURE_SUBDIR_ALIASES = new Map<string, string>([
  ['x-axis', 'chart/axis.ts'],
  ['y-axis', 'chart/axis.ts'],
  ['series', 'chart/series'],
  ['legend', 'chart/legend.ts'],
  ['tooltip', 'chart/tooltip.ts'],
  ['chart-aggregate', 'chart/aggregate.ts'],
  ['kpi-aggregate', 'kpi/aggregate.ts'],
  ['trend', 'kpi/trend.ts'],
  ['kpi-format', 'kpi/format.ts'],
  ['thresholds', 'kpi/thresholds'],
  ['sparkline', 'kpi/sparkline.ts'],
  ['grid-columns', 'gallery/grid-columns.ts'],
  ['gallery-card', 'gallery/card.ts'],
  ['twitter-card', 'twitter.ts'],
])

const CROSS_REFERENCE_DIRS = new Map<string, readonly string[]>([
  [join(APP_SCHEMA_DIR, 'components'), [join(APP_SCHEMA_DIR, 'pages', 'components')]],
])

const EXEMPT_FILENAMES = new Set([
  'index.ts',
  'index.test.ts',
  'language-config.ts',
  'reference.ts',
  'template.ts',
  'conditions.ts',
  'definition.ts',
  'base-component-fields.ts',
  'digest-config.ts',
  'group-reference.ts',
])

function isNameMirroringExempt(name: string): boolean {
  return EXEMPT_FILENAMES.has(name) || name.endsWith('-validation.ts')
}

async function validateNameMirroring(
  nodeSchema: Record<string, unknown>,
  fsDir: string,
  defs: Record<string, unknown>,
  schemaPrefix: string,
  issues: NameMirroringIssue[],
  isUnionParent = false,
  parentFolderName?: string
): Promise<void> {
  const properties = nodeSchema['properties'] as Record<string, Record<string, unknown>> | undefined
  if (!properties) return

  const expectedNames = new Map<string, { propName: string; type: 'object' | 'array' | 'simple' }>()
  for (const [propName, propSchema] of Object.entries(properties)) {
    const effectiveType = getEffectiveSchemaType(propSchema, defs)
    expectedNames.set(camelToKebab(propName), { propName, type: effectiveType })
  }

  let dirListing: string[]
  try {
    dirListing = await readdir(fsDir)
  } catch {
    return
  }

  const actualEntries: { name: string; kebabName: string; isDir: boolean }[] = []
  for (const name of dirListing) {
    if (isNameMirroringExempt(name)) continue
    if (name.endsWith('.test.ts') || name.endsWith('.test.tsx')) continue

    const entryStat = await stat(join(fsDir, name))
    const isDir = entryStat.isDirectory()
    const kebabName = camelToKebab(isDir ? name : name.replace(/\.ts$/, ''))
    actualEntries.push({ name, kebabName, isDir })
  }

  if (!isUnionParent) {
    const singularParentName = parentFolderName?.replace(/s$/, '')

    for (const entry of actualEntries) {
      if (!expectedNames.has(entry.kebabName)) {
        if (singularParentName && entry.kebabName === singularParentName) continue

        const camelName = kebabToCamel(entry.kebabName)
        const schemaPath = schemaPrefix ? `${schemaPrefix}.${camelName}` : camelName
        issues.push({
          schemaPath,
          fsPath: `src/domain/models/app/${relative(APP_SCHEMA_DIR, join(fsDir, entry.name))}`,
          kind: 'orphan',
          name: entry.name,
          detail: `"${entry.name}" has no matching schema key "${camelName}" in ${schemaPrefix || 'AppSchema'}`,
        })
      }
    }
  }

  const actualKebabNames = new Set(actualEntries.map((e) => e.kebabName))

  const crossRefDirs = CROSS_REFERENCE_DIRS.get(fsDir) ?? []
  const crossRefKebabNames = new Set<string>()
  for (const altDir of crossRefDirs) {
    try {
      const altListing = await readdir(altDir)
      for (const name of altListing) {
        if (isNameMirroringExempt(name)) continue
        if (name.endsWith('.test.ts') || name.endsWith('.test.tsx')) continue
        const altStat = await stat(join(altDir, name))
        const kebab = altStat.isDirectory() ? name : name.replace(/\.ts$/, '')
        crossRefKebabNames.add(kebab)
      }
    } catch {
    }
  }

  for (const [kebabName, info] of expectedNames) {
    if (info.type === 'simple') continue

    const propSchema = properties[info.propName]
    if (propSchema && isInlineableProperty(propSchema, defs)) continue

    if (!actualKebabNames.has(kebabName) && !crossRefKebabNames.has(kebabName)) {
      const aliasPath = DEEP_STRUCTURE_SUBDIR_ALIASES.get(kebabName)
      let foundViaAlias = false
      if (aliasPath) {
        const localAliasExists = await access(join(fsDir, aliasPath))
          .then(() => true)
          .catch(() => false)
        if (localAliasExists) {
          foundViaAlias = true
        } else {
          for (const altDir of crossRefDirs) {
            const altAliasExists = await access(join(altDir, aliasPath))
              .then(() => true)
              .catch(() => false)
            if (altAliasExists) {
              foundViaAlias = true
              break
            }
          }
        }
      }

      if (!foundViaAlias) {
        const schemaPath = schemaPrefix ? `${schemaPrefix}.${info.propName}` : info.propName
        issues.push({
          schemaPath,
          fsPath: `src/domain/models/app/${relative(APP_SCHEMA_DIR, fsDir)}/`,
          kind: 'missing',
          name: kebabName,
          detail: `Schema key "${info.propName}" has no matching ${info.type === 'array' ? 'folder' : 'file'} "${kebabName}" in ${relative(APP_SCHEMA_DIR, fsDir)}/`,
        })
      }
    }
  }

  for (const entry of actualEntries) {
    if (!entry.isDir) continue
    const info = expectedNames.get(entry.kebabName)
    if (!info) continue

    const propSchema = properties[info.propName]
    if (!propSchema) continue

    const resolved = resolveSchemaDeep(propSchema, defs)
    const folderPath = join(fsDir, entry.name)

    if (info.type === 'array') {
      const items = resolved['items'] as Record<string, unknown> | undefined
      if (items) {
        const itemRef = resolveSchemaRef(items, defs)
        const itemResolved = resolveSchemaDeep(items, defs)
        const isDiscriminatedUnion = !!(itemRef['anyOf'] || itemRef['oneOf'])
        if (itemResolved['properties'] && !isDiscriminatedUnion) {
          const childPrefix = schemaPrefix ? `${schemaPrefix}.${info.propName}` : info.propName
          await validateNameMirroring(
            itemResolved,
            folderPath,
            defs,
            childPrefix,
            issues,
            false,
            entry.kebabName
          )
        } else if (isDiscriminatedUnion) {
          const childPrefix = schemaPrefix ? `${schemaPrefix}.${info.propName}` : info.propName
          await validateNameMirroring(
            { properties: {} },
            folderPath,
            defs,
            childPrefix,
            issues,
            true,
            entry.kebabName
          )
        }
      }
    } else if (info.type === 'object') {
      const rawResolved = resolveSchemaRef(propSchema, defs)
      const rawUnion = rawResolved['anyOf'] || rawResolved['oneOf']
      const isObjectUnion = rawUnion
        ? (rawUnion as Record<string, unknown>[]).some((v) => {
            const rv = resolveSchemaRef(v as Record<string, unknown>, defs)
            return rv['properties'] || rv['type'] === 'object'
          })
        : false

      if (isObjectUnion) {
        const childPrefix = schemaPrefix ? `${schemaPrefix}.${info.propName}` : info.propName
        await validateNameMirroring(
          { properties: {} },
          folderPath,
          defs,
          childPrefix,
          issues,
          true,
          entry.kebabName
        )
      } else if (resolved['properties']) {
        const childPrefix = schemaPrefix ? `${schemaPrefix}.${info.propName}` : info.propName
        await validateNameMirroring(resolved, folderPath, defs, childPrefix, issues)
      }
    }
  }
}

function isSimpleSchemaProperty(
  propSchema: Record<string, unknown>,
  defs?: Record<string, unknown>
): boolean {
  let resolved = propSchema
  const ref = propSchema['$ref'] as string | undefined
  if (ref && defs) {
    const defKey = ref.replace(/^#\/\$defs\//, '')
    resolved = (defs[defKey] as Record<string, unknown>) ?? propSchema
  }

  if (resolved['type'] === 'string' && !resolved['properties'] && !resolved['items']) {
    return true
  }

  return false
}

async function validateSchemaStructure(): Promise<{
  issues: StoryValidationIssue[]
  result: SchemaStructureResult
}> {
  const issues: StoryValidationIssue[] = []

  const jsonSchema = generateAppJsonSchema() as Record<string, unknown>
  const defs = jsonSchema['$defs'] as Record<string, unknown> | undefined

  let rootSchema = jsonSchema
  const rootRef = jsonSchema['$ref'] as string | undefined
  if (rootRef && defs) {
    const defKey = rootRef.replace(/^#\/\$defs\//, '')
    rootSchema = (defs[defKey] as Record<string, unknown>) ?? jsonSchema
  }

  const props = rootSchema['properties'] as Record<string, unknown> | undefined
  const schemaPropertyNames = props ? Object.keys(props) : []

  const entries = await readdir(APP_SCHEMA_DIR, { withFileTypes: true })
  const folders = entries.filter((e) => e.isDirectory()).map((e) => e.name)

  const simpleFileProperties = schemaPropertyNames.filter((prop) => {
    const propSchema = props?.[prop] as Record<string, unknown> | undefined
    if (!propSchema) return false
    return isSimpleSchemaProperty(propSchema, defs)
  })
  const complexProperties = schemaPropertyNames.filter((p) => !simpleFileProperties.includes(p))

  const missingFolders: string[] = []
  for (const prop of complexProperties) {
    if (!folders.includes(prop)) {
      missingFolders.push(prop)
      issues.push({
        file: 'src/domain/models/app/',
        severity: 'error',
        message: `AppSchema property "${prop}" has no matching folder in src/domain/models/app/`,
      })
    }
  }

  const missingIndexFiles: string[] = []
  for (const folder of folders) {
    try {
      await access(join(APP_SCHEMA_DIR, folder, 'index.ts'))
    } catch {
      missingIndexFiles.push(folder)
      issues.push({
        file: `src/domain/models/app/${folder}/`,
        severity: 'error',
        message: `Folder "${folder}" is missing index.ts entry point`,
      })
    }
  }

  const orphanFolders: string[] = []
  for (const folder of folders) {
    if (!schemaPropertyNames.includes(folder)) {
      orphanFolders.push(folder)
      issues.push({
        file: `src/domain/models/app/${folder}/`,
        severity: 'warning',
        message: `Folder "${folder}" does not correspond to any AppSchema property (orphan)`,
      })
    }
  }

  const deepIssues: DeepStructureIssue[] = []

  for (const prop of complexProperties) {
    const folder = folders.includes(prop) ? prop : null
    if (!folder) continue

    const propSchema = props?.[prop] as Record<string, unknown> | undefined
    if (!propSchema) continue

    const resolved = resolveSchemaDeep(propSchema, defs ?? {})
    const folderPath = join(APP_SCHEMA_DIR, folder)

    if (resolved['type'] === 'array' || resolved['items']) {
      const items = resolved['items'] as Record<string, unknown> | undefined
      if (items) {
        const itemResolved = resolveSchemaDeep(items, defs ?? {})
        if (itemResolved['properties']) {
          await validateDeepStructure(itemResolved, folderPath, defs ?? {}, prop, deepIssues)
        }
      }
    } else if (resolved['properties']) {
      await validateDeepStructure(resolved, folderPath, defs ?? {}, prop, deepIssues)
    }
  }

  for (const di of deepIssues) {
    issues.push({
      file: di.fsPath,
      severity: 'warning',
      message: `Deep structure mismatch: "${di.propertyName}" is ${di.expectedType === 'file' ? 'object' : 'array'} type → expected ${di.expectedType} but found ${di.actualType} (${di.schemaPath})`,
    })
  }

  const nameMirroringIssues: NameMirroringIssue[] = []
  await validateNameMirroring(rootSchema, APP_SCHEMA_DIR, defs ?? {}, '', nameMirroringIssues)

  for (const ni of nameMirroringIssues) {
    issues.push({
      file: ni.fsPath,
      severity: 'warning',
      message: `Name mirroring: ${ni.detail}`,
    })
  }

  const discriminatedUnions: DiscriminatedUnionInfo[] = []
  findDiscriminatedUnions(
    rootSchema,
    defs ?? {},
    '',
    APP_SCHEMA_DIR,
    SPEC_APP_DIR,
    discriminatedUnions,
    new Set()
  )

  const variantCoverageIssues: VariantCoverageIssue[] = []
  await validateVariantCoverage(discriminatedUnions, variantCoverageIssues)

  for (const vi of variantCoverageIssues) {
    issues.push({
      file: vi.expectedSpecFile,
      severity: 'warning',
      message: `Variant coverage: ${vi.detail}`,
    })
  }

  return {
    issues,
    result: {
      appSchemaProperties: schemaPropertyNames,
      folders,
      simpleFileProperties,
      missingFolders,
      orphanFolders,
      missingIndexFiles,
      deepIssues,
      nameMirroringIssues,
      discriminatedUnions,
      variantCoverageIssues,
    },
  }
}

function validatePropertyUsCoverage(
  files: readonly UserStoryFileValidation[]
): StoryValidationIssue[] {
  const issues: StoryValidationIssue[] = []

  const jsonSchema = generateAppJsonSchema() as Record<string, unknown>

  const { paths: allPaths, recordPaths } = extractValidPaths(jsonSchema)

  const allPathsArray = [...allPaths]
  const structuralPathsSet = new Set(
    allPathsArray.filter((path) => allPathsArray.some((other) => other.startsWith(`${path}.`)))
  )

  const filteredPaths = allPathsArray
    .filter((path) => structuralPathsSet.has(path))
    .filter((path) => {
      for (const rp of recordPaths) {
        if (path === rp || path.startsWith(`${rp}.`)) return false
      }
      return true
    })

  const defs = jsonSchema['$defs'] as Record<string, unknown> | undefined
  let rootSchema = jsonSchema
  const rootRef = jsonSchema['$ref'] as string | undefined
  if (rootRef && defs) {
    const defKey = rootRef.replace(/^#\/\$defs\//, '')
    rootSchema = (defs[defKey] as Record<string, unknown>) ?? jsonSchema
  }
  const props = rootSchema['properties'] as Record<string, unknown> | undefined
  const topLevelKeys = props ? new Set(Object.keys(props)) : new Set<string>()

  const documentedPaths = new Set<string>()
  for (const file of files) {
    const yamlBlocks = extractYamlConfigBlocks(file.rawContent)
    for (const block of yamlBlocks) {
      let parsed: unknown
      try {
        parsed = Bun.YAML.parse(block.yaml)
      } catch {
        continue
      }

      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) continue

      const rootKeys = Object.keys(parsed as Record<string, unknown>)
      const isAppConfig = rootKeys.some((k) => topLevelKeys.has(k))
      if (!isAppConfig) continue

      for (const path of extractDotPaths(parsed)) {
        documentedPaths.add(path)
      }
    }
  }

  const acCoveredDomains = new Set<string>()
  for (const file of files) {
    const headerMatch = FILE_HEADER_SCHEMA_PATTERN.exec(file.rawContent)
    if (!headerMatch?.[1]) continue

    const headerRefs = [...headerMatch[1].matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? '')

    const hasAc = file.stories.some((story) => story.specIds.length > 0)
    if (!hasAc) continue

    for (const ref of headerRefs) {
      const appModelPrefix = 'src/domain/models/app/'
      if (ref.startsWith(appModelPrefix)) {
        const afterPrefix = ref.slice(appModelPrefix.length)
        const domain = afterPrefix.split('/')[0]
        if (domain) acCoveredDomains.add(domain)
      }
    }

    for (const story of file.stories) {
      if (story.specIds.length === 0) continue
      for (const ref of story.schemaRefs) {
        if (ref.startsWith('src/domain/models/app/')) {
          const afterPrefix = ref.slice('src/domain/models/app/'.length)
          const domain = afterPrefix.split('/')[0]
          if (domain) acCoveredDomains.add(domain)
        }
      }
    }
  }

  const allSchemaRefs = collectAllSchemaRefs(files)
  const refCoveredDomains = new Set<string>()
  for (const ref of allSchemaRefs) {
    const appModelPrefix = 'src/domain/models/app/'
    if (ref.startsWith(appModelPrefix)) {
      const afterPrefix = ref.slice(appModelPrefix.length)
      const domain = afterPrefix.split('/')[0]
      if (domain) refCoveredDomains.add(domain)
    }
  }

  const entries: PropertyCoverageEntry[] = []
  for (const path of filteredPaths.sort()) {
    const domain = path.split('.')[0] ?? ''
    const isLeaf = !structuralPathsSet.has(path)
    const isRecord = [...recordPaths].some((rp) => path === rp || path.startsWith(`${rp}.`))

    const hasYamlExample = documentedPaths.has(path)
    const hasAcCoverage = isRecord || acCoveredDomains.has(domain)
    const hasSchemaRef = isRecord || refCoveredDomains.has(domain)

    const dims = [hasYamlExample, hasAcCoverage, hasSchemaRef].filter(Boolean).length
    const coverageLevel: PropertyCoverageLevel = dims === 3 ? 'full' : dims > 0 ? 'partial' : 'none'

    entries.push({
      path,
      topLevelDomain: domain,
      isLeaf,
      isRecord,
      hasYamlExample,
      hasAcCoverage,
      hasSchemaRef,
      coverageLevel,
    })
  }

  const noneByDomain = new Map<string, PropertyCoverageEntry[]>()
  const partialByDomain = new Map<string, PropertyCoverageEntry[]>()

  for (const entry of entries) {
    if (entry.coverageLevel === 'none') {
      const list = noneByDomain.get(entry.topLevelDomain) ?? []
      list.push(entry)
      noneByDomain.set(entry.topLevelDomain, list)
    } else if (entry.coverageLevel === 'partial') {
      const list = partialByDomain.get(entry.topLevelDomain) ?? []
      list.push(entry)
      partialByDomain.set(entry.topLevelDomain, list)
    }
  }

  for (const [domain, domainEntries] of noneByDomain) {
    if (domainEntries.length >= 5) {
      const examples = domainEntries
        .slice(0, 5)
        .map((e) => `"${e.path}"`)
        .join(', ')
      const more = domainEntries.length > 5 ? ` and ${domainEntries.length - 5} more` : ''
      issues.push({
        file: 'schema-coverage',
        severity: 'error',
        message: `Schema domain "${domain}" has ${domainEntries.length} paths with no user story coverage (no YAML, no AC, no schema ref): ${examples}${more}`,
      })
    } else {
      for (const entry of domainEntries) {
        issues.push({
          file: 'schema-coverage',
          severity: 'error',
          message: `Schema path "${entry.path}" has no user story coverage (no YAML example, no acceptance criteria, no schema reference)`,
        })
      }
    }
  }

  for (const [domain, domainEntries] of partialByDomain) {
    if (domainEntries.length >= 5) {
      const missingYaml = domainEntries.filter((e) => !e.hasYamlExample).length
      const missingAc = domainEntries.filter((e) => !e.hasAcCoverage).length
      const missingRef = domainEntries.filter((e) => !e.hasSchemaRef).length
      const missingParts: string[] = []
      if (missingYaml > 0) missingParts.push(`${missingYaml} missing YAML`)
      if (missingAc > 0) missingParts.push(`${missingAc} missing AC`)
      if (missingRef > 0) missingParts.push(`${missingRef} missing schema ref`)
      issues.push({
        file: 'schema-coverage',
        severity: 'warning',
        message: `Schema domain "${domain}" has ${domainEntries.length} paths with partial coverage (${missingParts.join(', ')})`,
      })
    } else {
      for (const entry of domainEntries) {
        const missing: string[] = []
        if (!entry.hasYamlExample) missing.push('YAML example')
        if (!entry.hasAcCoverage) missing.push('acceptance criteria')
        if (!entry.hasSchemaRef) missing.push('schema reference')
        issues.push({
          file: 'schema-coverage',
          severity: 'warning',
          message: `Schema path "${entry.path}" has partial coverage (missing: ${missing.join(', ')})`,
        })
      }
    }
  }

  return issues
}

async function validateReadmeIndexes(): Promise<StoryValidationIssue[]> {
  const issues: StoryValidationIssue[] = []

  async function findReadmeFiles(dir: string): Promise<string[]> {
    const readmes: string[] = []
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          readmes.push(...(await findReadmeFiles(fullPath)))
        } else if (entry.name === 'README.md') {
          readmes.push(fullPath)
        }
      }
    } catch {
    }
    return readmes
  }

  const readmeFiles = await findReadmeFiles(USER_STORIES_DIR)

  for (const readmePath of readmeFiles) {
    const content = await readFile(readmePath, 'utf-8')
    const readmeRelative = readmePath.replace(`${process.cwd()}/`, '')
    const readmeDir = readmePath.replace(/\/README\.md$/, '')

    const countPattern =
      /\|\s*\[?\*?\*?([^|\]]*?)\*?\*?\]?\(\.\/([^/)]+)\/?\)\s*\|[^|]*\|\s*(\d+)\s*files?\s*\|/g
    let match
    while ((match = countPattern.exec(content)) !== null) {
      const subDir = match[2] ?? ''
      const claimedCount = parseInt(match[3] ?? '0', 10)
      const subDirPath = join(readmeDir, subDir)

      try {
        const entries = await readdir(subDirPath)
        const mdFiles = entries.filter(
          (f) => f.endsWith('.md') && f !== 'README.md' && f !== 'decisions.md'
        )
        const actualCount = mdFiles.length

        if (actualCount !== claimedCount) {
          issues.push({
            file: readmeRelative,
            severity: 'warning',
            message: `Feature area "${subDir}" claims ${claimedCount} files but has ${actualCount}`,
          })
        }
      } catch {
        issues.push({
          file: readmeRelative,
          severity: 'warning',
          message: `Feature area "${subDir}" directory does not exist`,
        })
      }
    }

    const sections = content.split(/^### /m).slice(1)
    for (const section of sections) {
      const sectionLines = section.split('\n')
      const sectionTitle = sectionLines[0]?.trim() ?? ''

      const linkPattern = /- \[.*?\]\(\.\/([^/]+)\//g
      let linkMatch
      const linkedFiles = new Set<string>()
      let sectionDir = ''

      while ((linkMatch = linkPattern.exec(section)) !== null) {
        sectionDir = linkMatch[1] ?? ''
        const fileMatch = section.slice(linkMatch.index).match(/- \[.*?\]\(\.\/[^/]+\/([^)]+)\)/)
        if (fileMatch?.[1]) {
          linkedFiles.add(fileMatch[1])
        }
      }

      if (!sectionDir || linkedFiles.size === 0) continue

      const sectionDirPath = join(readmeDir, sectionDir)
      try {
        const entries = await readdir(sectionDirPath)
        const mdFiles = entries.filter(
          (f) => f.endsWith('.md') && f !== 'README.md' && f !== 'decisions.md'
        )

        for (const mdFile of mdFiles) {
          if (!linkedFiles.has(mdFile)) {
            issues.push({
              file: readmeRelative,
              severity: 'warning',
              message: `Quick Links "${sectionTitle}" is missing link to ${sectionDir}/${mdFile}`,
            })
          }
        }
      } catch {
      }
    }
  }

  return issues
}

async function validateFeaturesStatus(
  allSpecIds: Set<string>,
  parsedFiles: readonly UserStoryFileValidation[]
): Promise<StoryValidationIssue[]> {
  const issues: StoryValidationIssue[] = []
  const featuresPath = join(USER_STORIES_DIR, 'FEATURES.md')

  let content: string
  try {
    content = await readFile(featuresPath, 'utf-8')
  } catch {
    return issues
  }

  const lines = content.split('\n')

  const storyUsIds = new Set<string>()
  const storyUsBaseIds = new Set<string>()
  for (const file of parsedFiles) {
    for (const story of file.stories) {
      storyUsIds.add(story.id)
      const baseId = story.id.replace(/-\d{3}$/, '')
      storyUsBaseIds.add(baseId)
    }
  }

  const featuresUsIds = new Set<string>()
  const featuresEntries: {
    usId: string
    feature: string
    status: string
    line: number
  }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''

    const rowMatch = line.match(
      /\|\s*([^|]+?)\s*\|\s*[^|]+?\s*\|\s*\d\s*\|(?:\s*[^|]*?\s*\|)?\s*(Planned|Specified|Covered)\s*\(?(US-[A-Z0-9-]+)?\)?\s*\|/
    )
    if (!rowMatch) continue

    const feature = rowMatch[1]?.trim() ?? ''
    const status = rowMatch[2]?.trim() ?? ''
    const usId = rowMatch[3]?.trim() ?? ''

    if (!usId) continue

    featuresUsIds.add(usId)
    featuresEntries.push({ usId, feature, status, line: i + 1 })

    if (status === 'Planned') {
      const fullPrefix = usId.replace(/^US-/, '')
      const prefixSegments = fullPrefix.split('-')
      let hasSpecs = false
      for (let len = prefixSegments.length; len >= 2; len--) {
        const candidatePrefix = prefixSegments.slice(0, len).join('-')
        if ([...allSpecIds].some((id) => id.startsWith(candidatePrefix))) {
          hasSpecs = true
          break
        }
      }

      if (hasSpecs) {
        issues.push({
          file: 'FEATURES.md',
          severity: 'warning',
          line: i + 1,
          message: `Feature "${feature}" is marked "Planned" but already has spec files (prefix: ${fullPrefix}). Consider updating to "Specified"`,
        })
      }
    }
  }

  for (const entry of featuresEntries) {
    if (entry.status === 'Planned') continue
    const hasMatchingStory =
      storyUsIds.has(entry.usId) ||
      storyUsBaseIds.has(entry.usId) ||
      [...storyUsIds].some((sid) => sid.startsWith(`${entry.usId}-`))
    if (!hasMatchingStory) {
      issues.push({
        file: 'FEATURES.md',
        severity: 'warning',
        line: entry.line,
        message: `FEATURES.md references "${entry.usId}" (${entry.status}) but no matching user story section exists`,
      })
    }
  }

  const unmatchedBaseIds = new Set<string>()
  for (const baseId of storyUsBaseIds) {
    const hasFeatureEntry =
      featuresUsIds.has(baseId) || [...featuresUsIds].some((fid) => baseId.startsWith(`${fid}-`))
    if (!hasFeatureEntry) {
      unmatchedBaseIds.add(baseId)
    }
  }

  if (unmatchedBaseIds.size > 0) {
    const sortedIds = [...unmatchedBaseIds].sort()
    if (sortedIds.length >= 5) {
      const examples = sortedIds.slice(0, 5).join(', ')
      const more = sortedIds.length > 5 ? ` and ${sortedIds.length - 5} more` : ''
      issues.push({
        file: 'FEATURES.md',
        severity: 'warning',
        message: `${sortedIds.length} user story IDs are not listed in FEATURES.md: ${examples}${more}`,
      })
    } else {
      for (const baseId of sortedIds) {
        issues.push({
          file: 'FEATURES.md',
          severity: 'warning',
          message: `User story "${baseId}" is not listed in FEATURES.md`,
        })
      }
    }
  }

  for (const entry of featuresEntries) {
    if (entry.status !== 'Covered') continue

    const matchingStories = parsedFiles.flatMap((f) =>
      f.stories.filter(
        (s) =>
          s.id === entry.usId ||
          s.id.startsWith(`${entry.usId}-`) ||
          s.id.replace(/-\d{3}$/, '') === entry.usId
      )
    )

    if (matchingStories.length === 0) continue

    const hasAnySpecIds = matchingStories.some((s) => s.specIds.length > 0)
    if (!hasAnySpecIds) {
      issues.push({
        file: 'FEATURES.md',
        severity: 'warning',
        line: entry.line,
        message: `Feature "${entry.feature}" is marked "Covered" but "${entry.usId}" has no spec IDs in its acceptance criteria`,
      })
    }
  }

  return issues
}


function validateUSIdConsistency(
  parsedFiles: readonly UserStoryFileValidation[]
): StoryValidationIssue[] {
  const issues: StoryValidationIssue[] = []

  for (const file of parsedFiles) {
    if (file.relativePath.endsWith('index.md')) continue
    if (file.stories.length === 0) continue

    const pathWithoutRole = file.relativePath
      .replace(/^as-developer\//, '')
      .replace(/^as-business-admin\//, '')
      .replace(/^as-end-user\//, '')

    const pathNoExt = pathWithoutRole.replace(/\.md$/, '')
    const segments = pathNoExt.split('/')

    const firstSeg = segments[0]
    if (firstSeg && PATH_ABBREVIATIONS[firstSeg]) {
      segments[0] = PATH_ABBREVIATIONS[firstSeg] as string
    }

    const expectedBase = segments.map((s) => s.toUpperCase()).join('-')
    const isMultiStory = file.stories.length > 1

    for (const story of file.stories) {
      if (story.id.includes('-CROSS-')) continue

      let matches = false
      if (isMultiStory) {
        matches = story.id.startsWith(`US-${expectedBase}-`)
      } else {
        matches = story.id === `US-${expectedBase}`
      }

      if (!matches) {
        const expected = isMultiStory ? `US-${expectedBase}-NNN` : `US-${expectedBase}`
        issues.push({
          file: file.relativePath,
          severity: 'warning',
          message: `US ID "${story.id}" does not match file path. Expected: ${expected}`,
          line: story.lineNumber,
        })
      }
    }
  }

  return issues
}

function validateACGranularity(
  parsedFiles: readonly UserStoryFileValidation[]
): StoryValidationIssue[] {
  const issues: StoryValidationIssue[] = []

  for (const file of parsedFiles) {
    if (file.relativePath.endsWith('index.md')) continue

    for (const story of file.stories) {
      const acCount = story.specIds.length
      if (acCount > AC_EXTREME_CAP) {
        issues.push({
          file: file.relativePath,
          severity: 'warning',
          message: `${story.id} has ${acCount} ACs (>${AC_EXTREME_CAP}), strongly consider splitting into sub-stories`,
          line: story.lineNumber,
        })
      } else if (acCount > AC_HIGH_CAP) {
        issues.push({
          file: file.relativePath,
          severity: 'warning',
          message: `${story.id} has ${acCount} ACs (>${AC_HIGH_CAP}), consider splitting`,
          line: story.lineNumber,
        })
      }
    }

    const totalACs = file.stories.reduce((sum, s) => sum + s.specIds.length, 0)
    if (totalACs === AC_LOW_FLOOR && file.stories.length > 0) {
      issues.push({
        file: file.relativePath,
        severity: 'warning',
        message: `File has only ${totalACs} AC total across ${file.stories.length} story(ies), consider merging with a related file`,
      })
    }
  }

  return issues
}

function validateSpecIdPrefixConsistency(
  parsedFiles: readonly UserStoryFileValidation[]
): StoryValidationIssue[] {
  const issues: StoryValidationIssue[] = []
  const reported = new Set<string>()

  for (const file of parsedFiles) {
    for (const story of file.stories) {
      for (const specId of story.specIds) {
        const prefixMatch = /^([A-Z]+-)/.exec(specId)
        if (!prefixMatch) continue

        const prefix = prefixMatch[1] ?? ''
        if (
          !(ALLOWED_SPEC_PREFIXES as readonly string[]).includes(prefix) &&
          !reported.has(prefix)
        ) {
          reported.add(prefix)
          issues.push({
            file: file.relativePath,
            severity: 'warning',
            message: `Spec ID "${specId}" uses unknown prefix "${prefix}". Allowed: ${ALLOWED_SPEC_PREFIXES.join(', ')}`,
            line: story.lineNumber,
          })
        }
      }
    }
  }

  return issues
}

function validateCrossStoryDuplicateSpecIds(
  parsedFiles: readonly UserStoryFileValidation[]
): StoryValidationIssue[] {
  const issues: StoryValidationIssue[] = []
  const specIdMap = new Map<string, Array<{ file: string; usId: string; line: number }>>()

  for (const file of parsedFiles) {
    for (const story of file.stories) {
      for (const specId of story.specIds) {
        if (isRegressionSpecId(specId)) continue

        const entries = specIdMap.get(specId) ?? []
        entries.push({ file: file.relativePath, usId: story.id, line: story.lineNumber })
        specIdMap.set(specId, entries)
      }
    }
  }

  for (const [specId, entries] of specIdMap) {
    const uniqueStories = new Set(entries.map((e) => e.usId))
    if (uniqueStories.size > 1) {
      const locations = entries.map((e) => `${e.usId} (${e.file})`).join(', ')
      issues.push({
        file: entries[0]?.file ?? 'unknown',
        severity: 'error',
        message: `Spec ID "${specId}" appears in ${uniqueStories.size} different stories: ${locations}`,
        line: entries[0]?.line,
      })
    }
  }

  return issues
}

async function runUserStoryValidation(
  allSpecIds: Set<string>,
  options: { skipSchema?: boolean; strict?: boolean } = {}
): Promise<{
  files: UserStoryFileValidation[]
  issues: StoryValidationIssue[]
  totalStories: number
  totalACs: number
  schemaStructure: SchemaStructureResult | null
  schemaStructureIssues: StoryValidationIssue[]
  usSpecMappingIssues: readonly USSpecMappingIssue[]
  usSpecMappings: readonly USSpecMapping[]
}> {
  const userStoryFiles = await findUserStoryFiles(USER_STORIES_DIR)
  const storyFiles = userStoryFiles.filter(
    (f) => !f.endsWith('README.md') && !f.endsWith('decisions.md') && !f.endsWith('FEATURES.md')
  )

  if (storyFiles.length === 0) {
    return {
      files: [],
      issues: [],
      totalStories: 0,
      totalACs: 0,
      schemaStructure: null,
      schemaStructureIssues: [],
      usSpecMappingIssues: [],
      usSpecMappings: [],
    }
  }

  const parsedFiles: UserStoryFileValidation[] = []
  for (const filePath of storyFiles) {
    const content = await readFile(filePath, 'utf-8')
    const relativePath = filePath.replace(`${USER_STORIES_DIR}/`, '')
    parsedFiles.push(parseUserStoryFileForValidation(relativePath, content))
  }

  const usIdConsistencyIssues = validateUSIdConsistency(parsedFiles)
  const acGranularityIssues = validateACGranularity(parsedFiles)
  const specPrefixIssues = validateSpecIdPrefixConsistency(parsedFiles)
  const crossStoryDuplicateIssues = validateCrossStoryDuplicateSpecIds(parsedFiles)

  const refIssues = await validateFileReferences(parsedFiles)

  const schemaCoherenceIssues = validateSchemaCoherence(parsedFiles)

  const schemaLinkingIssues = await validateSchemaLinking(parsedFiles)

  const apiSchemaConventionIssues = await validateApiSchemaDirectoryConvention()

  const apiSchemaStructureIssues = await validateApiSchemaStructure(parsedFiles)

  let schemaStructureIssues: StoryValidationIssue[] = []
  let schemaStructureResult: SchemaStructureResult | null = null
  let schemaPropertyCoverageIssues: StoryValidationIssue[] = []

  if (!options.skipSchema) {
    const structureValidation = await validateSchemaStructure()
    schemaStructureIssues = structureValidation.issues
    schemaStructureResult = structureValidation.result

    schemaPropertyCoverageIssues = validatePropertyUsCoverage(parsedFiles)
  }

  const readmeIssues = await validateReadmeIndexes()

  const featuresIssues = await validateFeaturesStatus(allSpecIds, parsedFiles)

  let usSpecMappingIssues: readonly USSpecMappingIssue[] = []
  let usSpecMappings: readonly USSpecMapping[] = []
  usSpecMappings = buildUSSpecMappings(parsedFiles)
  const allSpecFilePaths = await collectAllSpecFiles(join(process.cwd(), 'specs'))
  usSpecMappingIssues = await validateUSSpecMapping(usSpecMappings, allSpecFilePaths)

  const usSpecMappingStoryIssues: StoryValidationIssue[] = usSpecMappingIssues.map((mi) => ({
    file: mi.expectedSpecPath,
    severity: 'warning' as const,
    message: `US↔Spec: ${mi.detail}`,
  }))

  const allIssues: StoryValidationIssue[] = [
    ...parsedFiles.flatMap((f) => f.issues),
    ...refIssues,
    ...schemaCoherenceIssues,
    ...schemaLinkingIssues,
    ...apiSchemaConventionIssues,
    ...apiSchemaStructureIssues,
    ...readmeIssues,
    ...featuresIssues,
    ...usIdConsistencyIssues,
    ...acGranularityIssues,
    ...specPrefixIssues,
    ...crossStoryDuplicateIssues,
    ...usSpecMappingStoryIssues,
  ]

  const totalStories = parsedFiles.reduce((sum, f) => sum + f.stories.length, 0)
  const totalACs = parsedFiles.reduce(
    (sum, f) => sum + f.stories.reduce((s, story) => s + story.specIds.length, 0),
    0
  )

  return {
    files: parsedFiles,
    issues: allIssues,
    totalStories,
    totalACs,
    schemaStructure: schemaStructureResult,
    schemaStructureIssues: [...schemaStructureIssues, ...schemaPropertyCoverageIssues],
    usSpecMappingIssues,
    usSpecMappings,
  }
}


async function findSpecFiles(dir: string): Promise<string[]> {
  const files: string[] = []

  async function walk(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)

      if (entry.isDirectory()) {
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

  let match: RegExpExecArray | null

  TEST_PATTERN.lastIndex = 0
  TEST_FIXME_PATTERN.lastIndex = 0

  while ((match = TEST_PATTERN.exec(content)) !== null) {
    const testName = match[1]
    if (!testName) continue
    const matchIndex = match.index

    const beforeMatch = content.substring(0, matchIndex)
    const lineNumber = beforeMatch.split('\n').length

    const testStart = matchIndex
    let parenCount = 0
    let testEnd = testStart
    let foundFirstParen = false
    let inString: string | null = null
    let inSingleLineComment = false
    let inMultiLineComment = false
    let inRegex = false
    let lastSignificantChar = ''

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
      if (char === undefined) continue
      const prevChar = i > 0 ? content[i - 1] : ''
      const nextChar = i < content.length - 1 ? content[i + 1] : ''

      if (inSingleLineComment && char === '\n') {
        inSingleLineComment = false
        lastSignificantChar = '\n'
        continue
      }

      if (inMultiLineComment && char === '*' && nextChar === '/') {
        inMultiLineComment = false
        i++
        continue
      }

      if (inRegex && char === '/' && prevChar !== '\\') {
        inRegex = false
        lastSignificantChar = '/'
        continue
      }

      if (inSingleLineComment || inMultiLineComment) {
        continue
      }

      if (inRegex) {
        if (char === '\\' && nextChar) {
          i++
        }
        continue
      }

      if (inString === null) {
        if (char === '/' && nextChar === '/') {
          inSingleLineComment = true
          i++
          continue
        }
        if (char === '/' && nextChar === '*') {
          inMultiLineComment = true
          i++
          continue
        }
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

      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (inString === null) {
          inString = char
        } else if (inString === char) {
          inString = null
        }
      }

      if (inString === null) {
        if (char === '(') {
          parenCount++
          foundFirstParen = true
        } else if (char === ')') {
          parenCount--
        }
      }

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
    const hasThen = THEN_PATTERN.test(rawContent) || IMPLICIT_THEN_PATTERN.test(rawContent)

    const idMatch = testName.match(SPEC_ID_PATTERN)
    const id = idMatch?.[1] ?? null

    const tagMatch = rawContent.match(TAG_PATTERN)
    const tag = tagMatch ? ((tagMatch[1] ?? tagMatch[2]) as '@spec' | '@regression') || null : null
    const domainMatch = rawContent.match(DOMAIN_TAG_PATTERN)
    const domain = domainMatch?.[1] ?? null

    const isFixme = false

    tests.push({
      id,
      name: testName as string,
      tag,
      domain,
      hasGiven,
      hasWhen,
      hasThen,
      lineNumber,
      isFixme,
      rawContent,
    })
  }

  while ((match = TEST_FIXME_PATTERN.exec(content)) !== null) {
    const testName = match[1]
    if (!testName) continue
    const matchIndex = match.index

    const beforeMatch = content.substring(0, matchIndex)
    const lineNumber = beforeMatch.split('\n').length

    const testStart = matchIndex
    let parenCount = 0
    let testEnd = testStart
    let foundFirstParen = false
    let inString: string | null = null
    let inSingleLineComment = false
    let inMultiLineComment = false
    let inRegex = false
    let lastSignificantChar = ''

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
      if (char === undefined) continue
      const prevChar = i > 0 ? content[i - 1] : ''
      const nextChar = i < content.length - 1 ? content[i + 1] : ''

      if (inSingleLineComment && char === '\n') {
        inSingleLineComment = false
        lastSignificantChar = '\n'
        continue
      }

      if (inMultiLineComment && char === '*' && nextChar === '/') {
        inMultiLineComment = false
        i++
        continue
      }

      if (inRegex && char === '/' && prevChar !== '\\') {
        inRegex = false
        lastSignificantChar = '/'
        continue
      }

      if (inSingleLineComment || inMultiLineComment) {
        continue
      }

      if (inRegex) {
        if (char === '\\' && nextChar) {
          i++
        }
        continue
      }

      if (inString === null) {
        if (char === '/' && nextChar === '/') {
          inSingleLineComment = true
          i++
          continue
        }
        if (char === '/' && nextChar === '*') {
          inMultiLineComment = true
          i++
          continue
        }
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

      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (inString === null) {
          inString = char
        } else if (inString === char) {
          inString = null
        }
      }

      if (inString === null) {
        if (char === '(') {
          parenCount++
          foundFirstParen = true
        } else if (char === ')') {
          parenCount--
        }
      }

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
    const hasThen = THEN_PATTERN.test(rawContent) || IMPLICIT_THEN_PATTERN.test(rawContent)

    const idMatch = testName.match(SPEC_ID_PATTERN)
    const id = idMatch?.[1] ?? null

    const tagMatch = rawContent.match(TAG_PATTERN)
    const tag = tagMatch ? ((tagMatch[1] ?? tagMatch[2]) as '@spec' | '@regression') || null : null
    const domainMatch = rawContent.match(DOMAIN_TAG_PATTERN)
    const domain = domainMatch?.[1] ?? null

    tests.push({
      id,
      name: testName as string,
      tag,
      domain,
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
    const isRegressionTest =
      test.tag === '@regression' || (test.id !== null && isRegressionSpecId(test.id))
    if (isRegressionTest) {
      continue
    }

    if (!test.id && test.tag === '@spec') {
      issues.push({
        type: 'error',
        code: 'MISSING_SPEC_ID',
        message: `Test missing spec ID (expected format: APP-FEATURE-001)`,
        line: test.lineNumber,
        testId: test.name,
      })
    }

    if (test.isFixme && test.tag === '@spec') {
      const bodyWithoutComments = test.rawContent
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/['"`][^'"`]*['"`]/g, '')
      const hasRealCode =
        /\bexpect\s*\(/.test(bodyWithoutComments) ||
        /\bawait\s+\w/.test(bodyWithoutComments) ||
        /\bpage\./.test(bodyWithoutComments) ||
        /\bcaptureCliCommand\b/.test(bodyWithoutComments) ||
        /\bcaptureCliOutput\b/.test(bodyWithoutComments) ||
        /\bstartServerWithSchema\b/.test(bodyWithoutComments) ||
        /\bstartCliWithConfigFile\b/.test(bodyWithoutComments) ||
        /\bstartCliServer\b/.test(bodyWithoutComments) ||
        /\bcreateTemp/.test(bodyWithoutComments) ||
        /\bfetch\s*\(/.test(bodyWithoutComments) ||
        /\bconst\s+\w+\s*=/.test(bodyWithoutComments) ||
        /\blet\s+\w+\s*=/.test(bodyWithoutComments)
      if (!hasRealCode) {
        issues.push({
          type: 'warning',
          code: 'EMPTY_FIXME',
          message: `Fixme test has no implementation code — not ready for TDD pipeline`,
          line: test.lineNumber,
          testId: test.id || test.name,
        })
      }
    }

    if (test.tag === '@spec' && !test.isFixme) {
      const bodyWithoutCommentsForAssert = test.rawContent
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
      const hasExpectCall = /\bexpect[A-Za-z0-9]*\s*\(/.test(bodyWithoutCommentsForAssert)
      if (!hasExpectCall) {
        issues.push({
          type: 'error',
          code: 'ZERO_ASSERTIONS',
          message: `Non-fixme @spec test has zero expect() calls — false test giving false CI confidence`,
          line: test.lineNumber,
          testId: test.id || test.name,
        })
      }
    }

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

    if (!test.tag && !test.isFixme) {
      issues.push({
        type: 'error',
        code: 'MISSING_TAG',
        message: `Test missing tag (@spec or @regression)`,
        line: test.lineNumber,
        testId: test.id || test.name,
      })
    }

    if (test.tag && !test.domain) {
      issues.push({
        type: 'warning',
        code: 'MISSING_DOMAIN_TAG',
        message: `Test has ${test.tag} but missing @domain:* tag — run: bun run scripts/add-spec-tags.ts`,
        line: test.lineNumber,
        testId: test.id || test.name,
      })
    }

    if (test.name.length < 20) {
      issues.push({
        type: 'suggestion',
        code: 'SHORT_TEST_NAME',
        message: `Test name is too short - consider being more descriptive`,
        line: test.lineNumber,
        testId: test.id || test.name,
      })
    }

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

  const specTests = file.tests.filter((t) => t.tag === '@spec')
  const regressionTests = file.tests.filter((t) => t.tag === '@regression')

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
      type: 'warning',
      code: 'MISSING_REGRESSION',
      message: `File has ${specTests.length} @spec test(s) but no @regression test — add a regression test combining all specs as test.step() sections`,
    })
  }

  if (regressionTests.length > 0 && specTests.length > 0) {
    const specIds = specTests.map((t) => t.id).filter(Boolean) as string[]
    const combinedRegressionContent = regressionTests.map((r) => r.rawContent).join('\n')
    const missingSteps = specIds.filter((id) => !combinedRegressionContent.includes(id))
    if (missingSteps.length > 0) {
      const firstRegression = regressionTests[0]
      const regressionLabel =
        regressionTests.length > 1
          ? `${regressionTests.length} @regression tests are`
          : '@regression test is'
      issues.push({
        type: 'warning',
        code: 'REGRESSION_MISSING_STEPS',
        message: `${regressionLabel} missing test.step() for ${missingSteps.length}/${specIds.length} @spec IDs: ${missingSteps.slice(0, 5).join(', ')}${missingSteps.length > 5 ? ` ... and ${missingSteps.length - 5} more` : ''}`,
        line: firstRegression?.lineNumber,
        testId: firstRegression?.id || firstRegression?.name,
      })
    }
  }

  const specTestIds = file.tests
    .filter((t) => t.tag === '@spec' && t.id && !isRegressionSpecId(t.id))
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
          message: `Spec IDs are not sequential (gap between ${specTestIds[i - 1]} and ${specTestIds[i]}) — expected when IDs are shared across files`,
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

  if (parts[0] === 'app' || parts[0] === 'api' || parts[0] === 'static') {
    parts.shift()
  }

  return parts.join(' > ') || basename(filePath, '.spec.ts')
}

async function analyzeFile(filePath: string): Promise<SpecFile> {
  const content = await readFile(filePath, 'utf-8')
  const relativePath = relative(SPECS_DIR, filePath)
  const feature = extractFeatureName(filePath)

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
    for (const test of file.tests) {
      maxPoints += 100

      let testPoints = 0

      if (test.id) testPoints += 20

      if (test.tag) testPoints += 10

      if (test.hasGiven) testPoints += 20

      if (test.hasWhen) testPoints += 20

      if (test.hasThen) testPoints += 20

      if (!test.isFixme) testPoints += 10

      totalPoints += testPoints
    }
  }

  return maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 100
}

function detectDuplicateSpecIds(files: SpecFile[]): DuplicateSpecId[] {
  const specIdMap = new Map<string, Array<{ file: string; line: number; testName: string }>>()

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

  const duplicates: DuplicateSpecId[] = []

  for (const [specId, locations] of specIdMap) {
    if (locations.length > 1) {
      duplicates.push({ specId, locations })
    }
  }

  return duplicates.sort((a, b) => a.specId.localeCompare(b.specId))
}


async function findUserStoryFiles(dir: string): Promise<string[]> {
  const files: string[] = []

  async function walk(currentDir: string) {
    try {
      const entries = await readdir(currentDir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name)

        if (entry.isDirectory()) {
          if (entry.name === 'research') continue
          await walk(fullPath)
        } else if (
          entry.name.endsWith('.md') &&
          entry.name !== 'README.md' &&
          entry.name !== 'decisions.md'
        ) {
          files.push(fullPath)
        }
      }
    } catch {
    }
  }

  await walk(dir)
  return files.sort()
}

function parseUserStoryFile(content: string, filePath: string): UserStory[] {
  const stories: UserStory[] = []

  const featureAreaMatch = content.match(FEATURE_AREA_PATTERN)
  const roleMatch = content.match(ROLE_PATTERN)

  const pathParts = filePath.split('/')
  const roleDir = pathParts.find((p) => p.startsWith('as-'))
  const roleDirIndex = pathParts.indexOf(roleDir || '')
  const domainPart = roleDirIndex >= 0 ? pathParts[roleDirIndex + 1] : undefined
  const domain = domainPart ?? 'unknown'
  const featureArea = featureAreaMatch?.[1] || 'unknown'
  const role = roleMatch?.[1]?.trim() || 'unknown'

  const storyBlocks = content
    .split(/(?=^#{2,3}\s+US-)/m)
    .filter((block) => /^#{2,3}\s+US-/.test(block))

  for (const block of storyBlocks) {
    const idMatch = block.match(/^#{2,3}\s+(US-[A-Z][A-Z0-9-]+):\s+(.+)$/m)
    if (!idMatch) continue

    const storyId = idMatch[1]
    const title = idMatch[2]?.trim() || ''

    const storyMatch = block.match(/\*\*Story\*\*:\s*(.+)$/m)
    const story = storyMatch?.[1]?.trim() || ''

    const statusMatch = block.match(USER_STORY_STATUS_PATTERN)
    let status: 'complete' | 'partial' | 'not-started' = 'not-started'
    if (statusMatch) {
      const statusChar = statusMatch[1]
      if (statusChar === 'x') status = 'complete'
      else if (statusChar === '~') status = 'partial'
    }

    const acceptanceCriteria: AcceptanceCriterion[] = []

    ACCEPTANCE_CRITERIA_TABLE_ROW_PATTERN.lastIndex = 0

    let acMatch: RegExpExecArray | null
    while ((acMatch = ACCEPTANCE_CRITERIA_TABLE_ROW_PATTERN.exec(block)) !== null) {
      const specId = acMatch[1]
      const criterion = acMatch[2]?.trim() || ''

      if (specId) {
        acceptanceCriteria.push({
          id: specId,
          criterion,
          specTestId: specId,
          schema: '',
          status: 'not-started',
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

  const storiesToSpecify: UserStory[] = []
  const storiesSpecifiedNotImplemented: UserStory[] = []
  const storiesSpecifiedAndImplemented: UserStory[] = []

  for (const story of allStories) {
    const linkedSpecIds = story.acceptanceCriteria
      .map((ac) => ac.specTestId)
      .filter((id): id is string => id !== null)

    if (linkedSpecIds.length === 0) {
      storiesToSpecify.push(story)
    } else {
      const allImplemented = linkedSpecIds.every((id) => passingSpecIds.has(id))
      const someFixme = linkedSpecIds.some((id) => fixmeSpecIds.has(id))

      if (allImplemented) {
        storiesSpecifiedAndImplemented.push(story)
      } else if (someFixme) {
        storiesSpecifiedNotImplemented.push(story)
      } else {
        storiesToSpecify.push(story)
      }
    }
  }

  const total = allStories.length || 1
  const storiesToSpecifyPercent = Math.round((storiesToSpecify.length / total) * 100)
  const storiesSpecifiedNotImplementedPercent = Math.round(
    (storiesSpecifiedNotImplemented.length / total) * 100
  )
  const storiesSpecifiedAndImplementedPercent = Math.round(
    (storiesSpecifiedAndImplemented.length / total) * 100
  )

  const totalCriteria = allStories.reduce((sum, s) => sum + s.acceptanceCriteria.length, 0)

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

    const prettierConfig = await prettier.resolveConfig(filePath)
    const formattedContent = await prettier.format(updatedContent, {
      ...prettierConfig,
      parser: 'markdown',
    })

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

function updateAcceptanceCriteriaTables(
  content: string,
  fixmeSpecIds: Set<string>,
  passingSpecIds: Set<string>
): string {
  const tablePattern =
    /(\|\s*Spec\s*ID\s*\|\s*Criterion\s*\|\s*Status\s*)(\s*\|?\s*\n)(\|\s*[-:]+\s*\|\s*[-:]+\s*\|\s*[-:]+\s*)(\s*\|?\s*\n)((?:\|[^\n]+\|\s*\n?)+)/gi

  return content.replace(
    tablePattern,
    (
      _match,
      header: string,
      headerEnd: string,
      separator: string,
      separatorEnd: string,
      dataRows: string
    ) => {
      const newDataRows = dataRows
        .split('\n')
        .filter((row) => row.trim())
        .map((row) => {
          const rowMatch = row.match(
            /^\|\s*`?([A-Z]+-[A-Z0-9-]+-(?:\d{3}|REGRESSION))`?\s*\|\s*([^|]+)\s*\|(?:\s*[^|]*\s*\|)?$/
          )

          if (!rowMatch) return row

          const specId = rowMatch[1] ?? ''
          const criterion = rowMatch[2]?.trim() || ''

          let status = '[ ]'
          if (passingSpecIds.has(specId)) {
            status = '✅'
          } else if (fixmeSpecIds.has(specId)) {
            status = '⏳'
          }

          return `| ${specId} | ${criterion} | ${status} |`
        })
        .join('\n')

      return `${header}${headerEnd}${separator}${separatorEnd}${newDataRows}\n`
    }
  )
}

function detectOrphanedSpecIds(
  files: SpecFile[],
  userStoryMetrics: UserStoryMetrics
): OrphanedSpecId[] {
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

  const orphaned: OrphanedSpecId[] = []

  for (const file of files) {
    for (const test of file.tests) {
      if (test.id && !isRegressionSpecId(test.id) && !linkedSpecIds.has(test.id)) {
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

async function calculateTDDAutomationStats(totalFixme: number): Promise<TDDAutomationStats> {
  const { exec } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const execAsync = promisify(exec)

  const specIdPattern = /([A-Z]+-[A-Z0-9-]+-\d{3})/

  try {
    const { stdout } = await execAsync(
      'git log --oneline --since="30 days ago" --extended-regexp' +
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
        const source: 'tdd-pipeline' | 'manual' =
          message?.startsWith('[TDD]') || message?.startsWith('test(tdd):')
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

    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const fixedLast24h = commits.filter((c) => new Date(c.date) >= oneDayAgo).length
    const fixedLast7d = commits.filter((c) => new Date(c.date) >= sevenDaysAgo).length
    const fixedLast30d = commits.filter((c) => new Date(c.date) >= thirtyDaysAgo).length

    const activeDaysLast30d = new Set(
      commits.filter((c) => new Date(c.date) >= thirtyDaysAgo).map((c) => c.date.split('T')[0])
    ).size
    const avgFixesPerDay = activeDaysLast30d > 0 ? fixedLast30d / activeDaysLast30d : 0

    let estimatedDaysRemaining: number | null = null
    let estimatedCompletionDate: string | null = null

    if (avgFixesPerDay > 0 && totalFixme > 0) {
      estimatedDaysRemaining = Math.ceil(totalFixme / avgFixesPerDay)
      const completionDate = new Date(now.getTime() + estimatedDaysRemaining * 24 * 60 * 60 * 1000)
      estimatedCompletionDate = completionDate.toISOString().split('T')[0] || null
    }

    const recentFixes = commits.slice(0, 20).map((c) => ({
      specId: c.specId,
      date: c.date.replace('T', ' ').substring(0, 16),
      commitHash: c.hash.substring(0, 7),
      source: c.source,
    }))

    const commitsLast30d = commits.filter((c) => new Date(c.date) >= thirtyDaysAgo)
    const fixedByPipeline = commitsLast30d.filter((c) => c.source === 'tdd-pipeline').length
    const fixedManually = commitsLast30d.filter((c) => c.source === 'manual').length

    return {
      totalFixed: fixedLast30d,
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

    const { stdout: commitOutput } = await execAsync(
      'git log --oneline --since="30 days ago" --extended-regexp --grep="[A-Z]+-[A-Z0-9-]+-[0-9]{3}" --format="%H|%aI|%s"',
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

    const discrepancies: ProgressDiscrepancy[] = []

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

    for (const specId of passingSpecIds) {
      if (!fixedSpecIds.has(specId)) {
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

  return summaries.sort((a, b) => a.domain.localeCompare(b.domain))
}

function getStatusLabel(progressPercent: number): string {
  if (progressPercent === 100) return 'Complete'
  if (progressPercent >= 80) return 'Almost Done'
  if (progressPercent >= 50) return 'In Progress'
  return 'Early Stage'
}

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

  const domainSummaries = calculateDomainSummaries(state.files)

  const progressPercent = Math.round(
    (state.summary.totalPassing / Math.max(state.summary.totalTests, 1)) * 100
  )
  const progressFilled = Math.round(progressPercent / 5)
  const progressEmpty = 20 - progressFilled

  const health = getOverallHealth(progressPercent, state.tddAutomation.avgFixesPerDay)

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

  lines.push('# Spec Progress Report')
  lines.push('')
  lines.push(`> Generated: ${state.generatedAt}`)
  lines.push('>')
  lines.push('> Auto-generated by `bun run progress` • Track test coverage and TDD progress')
  lines.push('')

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
  lines.push('')

  lines.push('## 🎯 Next Steps')
  lines.push('')

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
  if (state.summary.duplicateSpecIds > 0) {
    lines.push(`| 🔄 Duplicate IDs | ${state.summary.duplicateSpecIds} |`)
  }
  if (state.summary.orphanedSpecIds > 0) {
    lines.push(`| 🔗 Orphaned Spec IDs | ${state.summary.orphanedSpecIds} |`)
  }
  lines.push('')


  if (state.userStoryMetrics && state.userStoryMetrics.totalStories > 0) {
    const metrics = state.userStoryMetrics

    lines.push('## 📋 User Stories Metrics')
    lines.push('')
    lines.push('| Category | Count | Percentage |')
    lines.push('|----------|-------|------------|')
    lines.push(`| **Total User Stories** | ${metrics.totalStories} | - |`)
    lines.push(`| **Total Spec IDs** | ${metrics.totalCriteria} | - |`)
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

    const implementedPercent = metrics.storiesSpecifiedAndImplementedPercent
    const implementedFilled = Math.round(implementedPercent / 5)
    const implementedEmpty = 20 - implementedFilled
    lines.push(
      `**User Story Coverage**: [${'█'.repeat(implementedFilled)}${'░'.repeat(implementedEmpty)}] ${implementedPercent}%`
    )
    lines.push('')

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


  if (state.tddAutomation.totalFixed > 0 || state.summary.totalFixme > 0) {
    lines.push('## 🤖 TDD Automation')
    lines.push('')


    lines.push('| Metric | Value |')
    lines.push('|--------|-------|')
    lines.push(`| Tests Fixed (30 days) | ${state.tddAutomation.totalFixed} |`)
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

    if (state.tddQueue.length > 0) {
      const queuePreviewCount = 20
      lines.push(`### 📋 Next in TDD Queue (${state.tddQueue.length} total)`)
      lines.push('')
      lines.push(
        '> Specs are processed in priority order: APP → MIG → STATIC → API → ADMIN. Within each domain, features are ordered by dependency chain or alphabetically.'
      )
      lines.push('')
      lines.push('| # | Spec ID | Description | File |')
      lines.push('|---|---------|-------------|------|')
      for (let i = 0; i < Math.min(queuePreviewCount, state.tddQueue.length); i++) {
        const item = state.tddQueue[i]!
        lines.push(
          `| ${i + 1} | \`${item.specId}\` | ${item.description} | \`${item.file}:${item.line}\` |`
        )
      }
      if (state.tddQueue.length > queuePreviewCount) {
        lines.push(`| ... | *${state.tddQueue.length - queuePreviewCount} more* | | |`)
      }
      lines.push('')
    }
  }

  if (state.duplicateSpecIds.length > 0) {
    lines.push('## ⚡ Structural Issues')
    lines.push('')

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

      lines.push(
        `**${file.metadata.passingTests}/${file.metadata.totalTests}** passing | ${file.metadata.fixmeTests} fixme | ${file.metadata.specTests} @spec | ${file.metadata.regressionTests} @regression`
      )
      lines.push('')

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


  return lines.join('\n')
}


async function fixHeaderCount(filePath: string, actualCount: number): Promise<boolean> {
  const content = await readFile(filePath, 'utf-8')

  const updatedContent = content.replace(/(\*\s*Spec Count:\s*)\d+/, `$1${actualCount}`)

  if (updatedContent !== content) {
    await writeFile(filePath, updatedContent)
    return true
  }
  return false
}


async function updateFeaturesProgress(
  userStoryMetrics: UserStoryMetrics,
  fixmeSpecIds: Set<string>,
  passingSpecIds: Set<string>
): Promise<void> {
  console.log('')
  console.log('Updating FEATURES.md progress and compiling priorities...')

  const featuresPath = join(USER_STORIES_DIR, 'FEATURES.md')
  let content: string
  try {
    content = await readFile(featuresPath, 'utf-8')
  } catch {
    console.log('  FEATURES.md not found, skipping')
    return
  }

  const parsed = parseFeaturesMd(content)
  if (parsed.entries.length === 0) {
    console.log('  No features parsed from FEATURES.md')
    return
  }

  const allStories = [
    ...userStoryMetrics.storiesSpecifiedAndImplemented,
    ...userStoryMetrics.storiesSpecifiedNotImplemented,
    ...userStoryMetrics.storiesToSpecify,
  ]

  const usIdToSpecIds = new Map<string, string[]>()
  const specPrefixToUsId = new Map<string, string>()

  for (const entry of parsed.entries) {
    const matchingStories = allStories.filter(
      (s) => s.id === entry.usId || s.id.startsWith(entry.usId + '-')
    )

    const specIds: string[] = []
    for (const story of matchingStories) {
      for (const ac of story.acceptanceCriteria) {
        if (ac.specTestId) {
          specIds.push(ac.specTestId)

          const prefix = ac.specTestId.replace(/-\d{3}$/, '').replace(/-REGRESSION(-\d+)?$/, '')
          const existing = specPrefixToUsId.get(prefix)
          if (!existing || entry.usId.length > existing.length) {
            specPrefixToUsId.set(prefix, entry.usId)
          }
        }
      }
    }

    if (specIds.length > 0) {
      usIdToSpecIds.set(entry.usId, specIds)
    }
  }

  const updates = new Map<string, { progress: string }>()
  for (const [usId, specIds] of usIdToSpecIds) {
    const total = specIds.length
    const passing = specIds.filter((id) => passingSpecIds.has(id)).length
    updates.set(usId, { progress: `${passing}/${total}` })
  }

  if (updates.size > 0) {
    const updatedContent = updateFeaturesMd(content, updates)
    if (updatedContent !== content) {
      const prettierConfig = await prettier.resolveConfig(featuresPath)
      const formattedContent = await prettier.format(updatedContent, {
        ...prettierConfig,
        parser: 'markdown',
      })
      await writeFile(featuresPath, formattedContent, 'utf-8')
      console.log(`  ✅ Updated progress for ${updates.size} features in FEATURES.md`)
    } else {
      console.log('  FEATURES.md progress unchanged')
    }
  }

  const projectRoot = join(USER_STORIES_DIR, '..', '..')
  const result = await compilePrioritiesSafe(projectRoot, specPrefixToUsId, true)
  if (result) {
    console.log(
      `  ✅ Compiled priorities: ${result.featureCount} features, ${result.dependencyCount} dependencies`
    )
    if (result.configUpdated) {
      console.log('  ✅ Updated feature-priorities.generated.ts')
    }
    console.log(`  ✅ Spec prefix mappings: ${specPrefixToUsId.size} prefixes`)
  }
}


async function main() {
  const args = process.argv.slice(2)
  const filterPattern = args.find((a) => a.startsWith('--filter='))?.replace('--filter=', '')
  const showFixmeOnly = args.includes('--fixme')
  const verifyProgress = args.includes('--verify-progress')
  const shouldFix = args.includes('--fix')
  const shouldUpdateStories = args.includes('--update-stories')
  const strictMode = args.includes('--strict')
  const noError = args.includes('--no-error')
  const skipStories = args.includes('--skip-stories')
  const skipSchema = args.includes('--skip-schema')

  console.log('Analyzing spec files...')
  console.log('')

  let specFiles = await findSpecFiles(SPECS_DIR)

  if (filterPattern) {
    const escapedPattern = filterPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escapedPattern)
    specFiles = specFiles.filter((f) => regex.test(f))
    console.log(`Filtered to ${specFiles.length} files matching: ${filterPattern}`)
  } else {
    console.log(`Found ${specFiles.length} spec files`)
  }

  const analyzedFiles: SpecFile[] = []

  for (const filePath of specFiles) {
    const file = await analyzeFile(filePath)
    analyzedFiles.push(file)
  }

  const totalTests = analyzedFiles.reduce((sum, f) => sum + f.metadata.totalTests, 0)
  const totalSpecs = analyzedFiles.reduce((sum, f) => sum + f.metadata.specTests, 0)
  const totalRegressions = analyzedFiles.reduce((sum, f) => sum + f.metadata.regressionTests, 0)
  const totalFixme = analyzedFiles.reduce((sum, f) => sum + f.metadata.fixmeTests, 0)
  const totalPassing = analyzedFiles.reduce((sum, f) => sum + f.metadata.passingTests, 0)

  const qualityScore = calculateQualityScore(analyzedFiles)
  const duplicateSpecIds = detectDuplicateSpecIds(analyzedFiles)
  const tddAutomation = await calculateTDDAutomationStats(totalFixme)

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

  const tddQueue: TDDQueueItem[] = []
  for (const file of analyzedFiles) {
    for (const test of file.tests) {
      if (test.isFixme && test.id) {
        const descMatch = test.name.match(/[A-Z]+-[A-Z-]+-(?:\d{3}|REGRESSION(?:-\d+)?):\s*(.+)/)
        const description = descMatch?.[1]?.trim() ?? test.name
        tddQueue.push({
          specId: test.id,
          description,
          file: file.relativePath,
          line: test.lineNumber,
          priority: calculateSpecPriority(test.id, {
            file: file.relativePath,
            line: test.lineNumber,
          }),
        })
      }
    }
  }
  tddQueue.sort((a, b) => a.priority - b.priority || a.specId.localeCompare(b.specId))

  console.log('Analyzing user stories...')
  const userStoryMetrics = await parseUserStoryFiles(analyzedFiles, fixmeSpecIds, passingSpecIds)
  const orphanedSpecIds = detectOrphanedSpecIds(analyzedFiles, userStoryMetrics)

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

  const allIssuesWithDuplicates = analyzedFiles.flatMap((f) => f.issues)
  const errorsWithDuplicates = allIssuesWithDuplicates.filter((i) => i.type === 'error').length
  const warningsWithDuplicates = allIssuesWithDuplicates.filter((i) => i.type === 'warning').length
  const suggestionsWithDuplicates = allIssuesWithDuplicates.filter(
    (i) => i.type === 'suggestion'
  ).length

  let earlySchemaStructure: SchemaStructureResult | null = null
  let earlySchemaIssues: StoryValidationIssue[] = []
  if (!skipSchema) {
    const structureValidation = await validateSchemaStructure()
    earlySchemaStructure = structureValidation.result
    earlySchemaIssues = structureValidation.issues
  }

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
    duplicateSpecIds,
    orphanedSpecIds,
    tddAutomation,
    tddQueue,
    userStoryMetrics,
    schemaStructure: earlySchemaStructure,
  }

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

    await updateFeaturesProgress(userStoryMetrics, fixmeSpecIds, passingSpecIds)

    await reloadGeneratedConfig()
    for (const item of state.tddQueue) {
      item.priority = calculateSpecPriority(item.specId, {
        file: item.file,
        line: item.line,
      })
    }
    state.tddQueue.sort((a, b) => a.priority - b.priority || a.specId.localeCompare(b.specId))
  }

  const markdown = generateMarkdown(state)

  const prettierConfig = await prettier.resolveConfig(OUTPUT_FILE)
  const formattedMarkdown = await prettier.format(markdown, {
    ...prettierConfig,
    parser: 'markdown',
  })
  await writeFile(OUTPUT_FILE, formattedMarkdown)

  try {
    const userStoryFilePaths = await findUserStoryFiles(USER_STORIES_DIR)
    const parsedUserStoryFiles: UserStoryFileValidation[] = []
    for (const filePath of userStoryFilePaths) {
      if (
        filePath.endsWith('README.md') ||
        filePath.endsWith('decisions.md') ||
        filePath.endsWith('FEATURES.md')
      ) {
        continue
      }
      try {
        const content = await readFile(filePath, 'utf-8')
        const relativePath = filePath.replace(`${USER_STORIES_DIR}/`, '')
        parsedUserStoryFiles.push(parseUserStoryFileForValidation(relativePath, content))
      } catch {
      }
    }

    const internalManifest = await buildInternalComingSoonManifest(
      parsedUserStoryFiles,
      fixmeSpecIds,
      passingSpecIds
    )

    await mkdir(dirname(COMING_SOON_INTERNAL_FILE), { recursive: true })
    const internalJson = JSON.stringify(internalManifest, null, 2) + '\n'
    await writeFile(COMING_SOON_INTERNAL_FILE, internalJson, 'utf-8')

    await mkdir(dirname(COMING_SOON_REGISTRY_FILE), { recursive: true })
    const registrySource = toRegistrySource(internalManifest)
    const registryPrettierConfig = await prettier.resolveConfig(fileURLToPath(import.meta.url))
    const registryFormatOptions = { ...(registryPrettierConfig ?? {}), plugins: [] as string[] }
    const formattedRegistry = await prettier.format(registrySource, {
      ...registryFormatOptions,
      parser: 'typescript',
    })
    await writeFile(COMING_SOON_REGISTRY_FILE, formattedRegistry, 'utf-8')
  } catch (error) {
    console.log(
      `[coming-soon] warning: failed to build manifest — ${error instanceof Error ? error.message : String(error)}`
    )
  }

  try {
    await access(OLD_OUTPUT_FILE)
    await unlink(OLD_OUTPUT_FILE)
    console.log(`Deleted old file: SPEC-STATE.md (migrated to SPEC-PROGRESS.md)`)
  } catch {
  }

  const progressPercent = Math.round((totalPassing / Math.max(totalTests, 1)) * 100)
  try {
    const readmeContent = await readFile(README_FILE, 'utf-8')

    const specsBadge = `specs-${progressPercent}%25%20(${totalPassing}%2F${totalTests})-blue`
    const qualityBadge = `quality-${qualityScore}%25-brightgreen`
    const progressBadge = `progress-${progressPercent}%25-blue`

    const updatedReadme = readmeContent
      .replace(
        /<img src="https:\/\/img\.shields\.io\/badge\/progress-\d+%25-blue"/,
        `<img src="https://img.shields.io/badge/${progressBadge}"`
      )
      .replace(
        /\[!\[Spec Progress\]\(<https:\/\/img\.shields\.io\/badge\/specs-[^>]+>\)\]/,
        `[![Spec Progress](<https://img.shields.io/badge/${specsBadge}>)]`
      )
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
      .replace(/SPEC-STATE\.md/g, 'SPEC-PROGRESS.md')

    if (updatedReadme !== readmeContent) {
      const formattedReadme = await prettier.format(updatedReadme, {
        ...prettierConfig,
        parser: 'markdown',
      })
      await writeFile(README_FILE, formattedReadme)
      console.log(`✅ Updated: ${README_FILE}`)
    }
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
      console.log(`⚠️  README badge update skipped: ${error.message}`)
    }
  }

  const orphanedCount = orphanedSpecIds.length
  const sep = '─'.repeat(50)
  const wideSep = '─'.repeat(80)

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

    try {
      storyResult = await runUserStoryValidation(allSpecIds, { skipSchema, strict: strictMode })
    } catch (error) {
      console.log(
        `⚠️  User Stories validation skipped: ${error instanceof Error ? error.message : String(error)}`
      )
      storyResult = null
    }

    if (storyResult === null) {
    } else if (storyResult.files.length === 0) {
      console.log('⚠️  No user story files found in docs/user-stories/')
    } else {
      const errors = storyResult.issues.filter((i) => i.severity === 'error')
      const warnings = storyResult.issues.filter((i) => i.severity === 'warning')

      const storyOnlyWarnings = warnings
      const specRoutedWarnings: typeof warnings = []

      storyValidationErrors = errors.length
      storyValidationWarnings = warnings.length

      if (errors.length > 0) {
        console.log(
          `❌ User Stories failed (${errors.length} errors, ${storyOnlyWarnings.length} warnings, ${specRoutedWarnings.length} spec-routed)`
        )
        for (const issue of errors) {
          const loc = issue.line ? `:${issue.line}` : ''
          console.log(`   ${issue.file}${loc}: ${issue.message}`)
        }
        if (storyOnlyWarnings.length > 0) {
          for (const issue of storyOnlyWarnings.slice(0, 10)) {
            const loc = issue.line ? `:${issue.line}` : ''
            console.log(`   ${issue.file}${loc}: ${issue.message}`)
          }
          if (storyOnlyWarnings.length > 10) {
            console.log(`   ... and ${storyOnlyWarnings.length - 10} more warnings`)
          }
        }
      } else if (storyOnlyWarnings.length > 0) {
        console.log(
          `⚠️  User Stories passed with ${storyOnlyWarnings.length} warning(s) (${storyResult.files.length} files, ${storyResult.totalStories} stories)${specRoutedWarnings.length > 0 ? ` [${specRoutedWarnings.length} spec-related → Specs sector]` : ''}`
        )
        for (const issue of storyOnlyWarnings.slice(0, 10)) {
          const loc = issue.line ? `:${issue.line}` : ''
          console.log(`   ${issue.file}${loc}: ${issue.message}`)
        }
        if (storyOnlyWarnings.length > 10) {
          console.log(`   ... and ${storyOnlyWarnings.length - 10} more warnings`)
        }
      } else if (specRoutedWarnings.length > 0) {
        console.log(
          `✅ User Stories passed (${storyResult.files.length} files, ${storyResult.totalStories} stories, ${storyResult.totalACs} ACs) [${specRoutedWarnings.length} spec-related → Specs sector]`
        )
      } else {
        console.log(
          `✅ User Stories passed (${storyResult.files.length} files, ${storyResult.totalStories} stories, ${storyResult.totalACs} ACs)`
        )
      }
    }
  } else {
    console.log('⏭️  User Stories skipped (--skip-stories)')
  }

  let schemaStructureErrors = 0
  let schemaStructureWarnings = 0

  if (!skipSchema) {
    const schemaIssues: StoryValidationIssue[] =
      storyResult?.schemaStructureIssues ?? earlySchemaIssues
    const ss = earlySchemaStructure

    const schemaErrors = schemaIssues.filter((i) => i.severity === 'error')
    const schemaWarns = schemaIssues.filter((i) => i.severity === 'warning')
    const schemaInfos = schemaIssues.filter((i) => i.severity === 'info')
    schemaStructureErrors = schemaErrors.length
    schemaStructureWarnings = schemaWarns.length

    const deepCount = ss?.deepIssues.length ?? 0

    if (schemaErrors.length > 0) {
      console.log(
        `❌ Schema Structure failed (${schemaErrors.length} errors, ${schemaWarns.length} warnings)`
      )
      for (const issue of schemaErrors) {
        console.log(`   ${issue.file}: ${issue.message}`)
      }
    } else if (schemaWarns.length > 0) {
      console.log(
        `⚠️  Schema Structure passed with warnings (${ss?.appSchemaProperties.length ?? 0} properties, ${ss?.folders.length ?? 0} folders, ${schemaWarns.length} warnings)`
      )
      for (const issue of schemaWarns.slice(0, 10)) {
        console.log(`   ${issue.file}: ${issue.message}`)
      }
      if (schemaWarns.length > 10) {
        console.log(`   ... and ${schemaWarns.length - 10} more warnings`)
      }
    } else {
      const infoSuffix = schemaInfos.length > 0 ? `, ${schemaInfos.length} info` : ''
      console.log(
        `✅ Schema Structure passed (${ss?.appSchemaProperties.length ?? 0} properties, ${ss?.folders.length ?? 0} folders${infoSuffix})`
      )
    }

    if (deepCount > 0) {
      console.log(`   📐 ${deepCount} deep structure mismatches (object≠file or array≠folder):`)
      for (const di of (ss?.deepIssues ?? []).slice(0, 10)) {
        const typeLabel = di.expectedType === 'file' ? 'object→file' : 'array→folder'
        console.log(`      ${di.schemaPath}: expected ${typeLabel}, found ${di.actualType}`)
      }
      if (deepCount > 10) {
        console.log(`      ... and ${deepCount - 10} more`)
      }
    }

    const nameIssues = ss?.nameMirroringIssues ?? []
    const orphanNames = nameIssues.filter((n) => n.kind === 'orphan')
    const missingNames = nameIssues.filter((n) => n.kind === 'missing')
    if (nameIssues.length > 0) {
      console.log(
        `   🔤 ${nameIssues.length} name mirroring issues (${orphanNames.length} orphans, ${missingNames.length} missing):`
      )
      for (const ni of nameIssues.slice(0, 10)) {
        const icon = ni.kind === 'orphan' ? '?' : '!'
        console.log(`      ${icon} ${ni.detail}`)
      }
      if (nameIssues.length > 10) {
        console.log(`      ... and ${nameIssues.length - 10} more`)
      }
    }

    const variantIssues = ss?.variantCoverageIssues ?? []
    const unionCount = ss?.discriminatedUnions.length ?? 0
    if (variantIssues.length > 0) {
      console.log(
        `   🔀 ${variantIssues.length} missing variant spec files (${unionCount} unions found):`
      )
      for (const vi of variantIssues.slice(0, 10)) {
        console.log(`      ! ${vi.detail}`)
      }
      if (variantIssues.length > 10) {
        console.log(`      ... and ${variantIssues.length - 10} more`)
      }
    } else if (unionCount > 0) {
      console.log(`   🔀 All ${unionCount} discriminated unions have full variant spec coverage`)
    }

    const usMappingIssues = storyResult?.usSpecMappingIssues ?? []
    const usMappings = storyResult?.usSpecMappings ?? []
    if (usMappings.length > 0) {
      const missingFiles = usMappingIssues.filter((i) => i.kind === 'missing-spec-file')
      const orphanFiles = usMappingIssues.filter((i) => i.kind === 'orphan-spec-file')
      const namingIssues = usMappingIssues.filter(
        (i) =>
          i.kind === 'describe-missing-us-id' ||
          i.kind === 'test-missing-spec-id' ||
          i.kind === 'spec-id-not-in-ac' ||
          i.kind === 'ac-spec-id-not-in-file'
      )
      const mappedCount = usMappings.length - missingFiles.length

      console.log(
        `   📎 US↔Spec Migration: ${mappedCount}/${usMappings.length} US IDs mapped (${Math.round((mappedCount * 100) / usMappings.length)}%)`
      )

      if (usMappingIssues.length > 0) {
        console.log(
          `      ${usMappingIssues.length} issues (${missingFiles.length} missing files, ${orphanFiles.length} orphan files, ${namingIssues.length} naming)`
        )
        for (const mi of missingFiles.slice(0, 3)) {
          console.log(`      ! ${mi.detail}`)
        }
        if (missingFiles.length > 3) {
          console.log(`      ... and ${missingFiles.length - 3} more missing files`)
        }
        for (const mi of orphanFiles.slice(0, 3)) {
          console.log(`      ? ${mi.detail}`)
        }
        if (orphanFiles.length > 3) {
          console.log(`      ... and ${orphanFiles.length - 3} more orphan files`)
        }
        for (const mi of namingIssues.slice(0, 3)) {
          console.log(`      ~ ${mi.detail}`)
        }
        if (namingIssues.length > 3) {
          console.log(`      ... and ${namingIssues.length - 3} more naming issues`)
        }
      }
    }
  } else {
    console.log('⏭️  Schema Structure skipped (--skip-schema)')
  }

  {
    const driftCategories: { label: string; items: string[] }[] = []

    const yamlPathIssues = (storyResult?.issues ?? []).filter(
      (i) => i.severity === 'warning' && i.message.includes('does not exist in AppSchema')
    )
    if (yamlPathIssues.length > 0) {
      driftCategories.push({
        label: 'YAML paths not in schema',
        items: yamlPathIssues.map((i) => `${i.file}: ${i.message}`),
      })
    }

    const unlinkIssues = (storyResult?.issues ?? []).filter(
      (i) => i.severity === 'warning' && i.message.includes('not linked to any user story')
    )
    if (unlinkIssues.length > 0) {
      driftCategories.push({
        label: 'Schema files not linked to stories',
        items: unlinkIssues.map((i) => i.message),
      })
    }

    const zeroCoverageIssues = (storyResult?.schemaStructureIssues ?? earlySchemaIssues).filter(
      (i) =>
        i.severity === 'error' &&
        (i.message.includes('has no user story coverage') ||
          i.message.includes('not documented in any user story'))
    )
    if (zeroCoverageIssues.length > 0) {
      driftCategories.push({
        label: 'Undocumented schema paths (no coverage)',
        items: zeroCoverageIssues.map((i) => i.message),
      })
    }

    const partialCoverageIssues = (storyResult?.schemaStructureIssues ?? earlySchemaIssues).filter(
      (i) => i.severity === 'warning' && i.message.includes('has partial coverage')
    )
    if (partialCoverageIssues.length > 0) {
      driftCategories.push({
        label: 'Partially documented schema paths',
        items: partialCoverageIssues.map((i) => i.message),
      })
    }

    const structureDrift = (storyResult?.schemaStructureIssues ?? earlySchemaIssues).filter(
      (i) =>
        i.severity === 'warning' &&
        (i.message.startsWith('Deep structure') ||
          i.message.startsWith('Name mirroring') ||
          i.message.startsWith('Variant coverage'))
    )
    if (structureDrift.length > 0) {
      driftCategories.push({
        label: 'Structure mismatches',
        items: structureDrift.map((i) => i.message),
      })
    }

    if (driftCategories.length > 0) {
      const totalDrift = driftCategories.reduce((sum, c) => sum + c.items.length, 0)
      console.log('')
      console.log(
        `📊 Schema Drift Summary: ${totalDrift} issue(s) across ${driftCategories.length} categories`
      )
      for (const cat of driftCategories) {
        console.log(`   ${cat.label} (${cat.items.length}):`)
        for (const item of cat.items.slice(0, 5)) {
          console.log(`      ⚠ ${item}`)
        }
        if (cat.items.length > 5) {
          console.log(`      ... and ${cat.items.length - 5} more`)
        }
      }
    }
  }

  const specErrors = errorsWithDuplicates
  const specWarnings = warningsWithDuplicates

  if (specErrors > 0) {
    console.log(`❌ Spec Tests failed (${specErrors} errors, ${specWarnings} warnings)`)
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

  if (tddAutomation.totalFixed > 0 || totalFixme > 0) {
    console.log(
      `🔄 TDD Pipeline (${totalFixme} remaining, ${tddAutomation.totalFixed} fixed in 30d)`
    )
  } else {
    console.log('✅ TDD Pipeline (no remaining fixme)')
  }

  const totalErrors = errorsWithDuplicates + storyValidationErrors + schemaStructureErrors
  const totalWarnings =
    warningsWithDuplicates + storyValidationWarnings + orphanedCount + schemaStructureWarnings
  const hasErrors = totalErrors > 0
  const hasWarnings = totalWarnings > 0
  const hasIssues = hasErrors || hasWarnings

  if (hasIssues) {
    const icon = hasErrors ? '❌' : '⚠️'
    console.log('')
    console.log(sep)
    console.log(`${icon} Content Quality: ${totalErrors} error(s), ${totalWarnings} warning(s)`)
    console.log(sep)

    type IssueEntry = {
      readonly severity: string
      readonly text: string
    }

    function classifyStoryIssue(issue: StoryValidationIssue): string {
      const msg = issue.message
      if (msg.includes('does not exist in AppSchema') || msg.includes('looks like a typo'))
        return 'Schema Coherence'
      if (msg.includes('not linked to any user story')) return 'Schema Linking'
      if (msg.includes('does not match') && msg.includes('JSON block')) return 'Schema Coherence'
      if (msg.includes('Feature area') || msg.includes('Quick Links')) return 'README Index'
      if (msg.includes('marked') && msg.includes('but already has')) return 'FEATURES.md Status'
      if (msg.includes('not listed in FEATURES.md')) return 'FEATURES.md Status'
      if (msg.includes('FEATURES.md references') && msg.includes('no matching user story'))
        return 'FEATURES.md Status'
      if (msg.includes('marked "Covered"') && msg.includes('no spec IDs'))
        return 'FEATURES.md Status'
      if (
        msg.includes('Missing H1') ||
        msg.includes('Missing Feature Area') ||
        msg.includes('No user story sections') ||
        msg.includes('Missing "**As a**"') ||
        msg.includes('Missing "**I want to**"') ||
        msg.includes('Missing "**so that**"') ||
        msg.includes('Missing ### Acceptance') ||
        msg.includes('Missing ### Implementation') ||
        msg.includes('AC table header') ||
        msg.includes('US ID') ||
        msg.includes('Duplicate user story ID') ||
        msg.includes('Duplicate Spec ID')
      )
        return 'Story Structure'
      if (msg.includes('Schema path does not exist')) return 'Schema Path'
      if (msg.startsWith('API schema convention')) return 'API Schema Convention'
      if (
        msg.includes('API route domain') ||
        msg.includes('API schema directory') ||
        msg.includes('API schema file') ||
        msg.includes('API route sub-resource')
      )
        return 'API Schema Structure'
      return 'Other'
    }

    function classifySchemaIssue(issue: StoryValidationIssue): string {
      const msg = issue.message
      if (msg.startsWith('Deep structure')) return 'Deep Structure'
      if (msg.startsWith('Name mirroring')) return 'Name Mirroring'
      if (msg.startsWith('Variant coverage')) return 'Variant Coverage'
      if (msg.startsWith('US↔Spec')) return 'US↔Spec Mapping'
      if (msg.includes('not documented in any user story')) return 'Property Coverage'
      if (msg.includes('has no user story coverage')) return 'Property Coverage'
      if (msg.includes('has partial coverage')) return 'Property Coverage'
      if (msg.includes('no matching folder') || msg.includes('missing index.ts'))
        return 'Folder Structure'
      if (msg.includes('orphan') || msg.includes('does not correspond')) return 'Folder Structure'
      return 'Other'
    }

    const specCodeLabels: Record<string, string> = {
      MISSING_SPEC_ID: 'Test Identity',
      MISSING_TAG: 'Test Identity',
      VAGUE_TEST_NAME: 'Test Identity',
      SHORT_TEST_NAME: 'Test Identity',
      DUPLICATE_SPEC_ID: 'Test Identity',
      HEADER_COUNT_MISMATCH: 'Spec Count',
      EMPTY_FIXME: 'Test Structure',
      MISSING_GIVEN: 'Test Structure',
      MISSING_WHEN: 'Test Structure',
      MISSING_THEN: 'Test Structure',
      TODO_IN_TEST: 'Test Structure',
      MISSING_REGRESSION: 'Regression Coverage',
      REGRESSION_MISSING_STEPS: 'Regression Coverage',
      NON_SEQUENTIAL_IDS: 'Spec Sequencing',
    }

    function formatIssue(
      severity: string,
      file: string,
      line: number | undefined,
      message: string
    ): string {
      const sev = severity === 'error' ? 'ERROR' : 'WARN'
      const loc = line ? `:${line}` : ''
      return `[${sev}] ${file}${loc}: ${message}`
    }

    function printTypeBuckets(
      sectorLabel: string,
      buckets: Map<string, IssueEntry[]>,
      maxPerType: number = 5
    ) {
      const total = [...buckets.values()].reduce((sum, items) => sum + items.length, 0)
      if (total === 0) return

      const errorCount = [...buckets.values()].flat().filter((i) => i.severity === 'error').length
      const warnCount = total - errorCount
      const parts: string[] = []
      if (errorCount > 0) parts.push(`${errorCount} error(s)`)
      if (warnCount > 0) parts.push(`${warnCount} warning(s)`)

      console.log('')
      console.log(`  ${sectorLabel}: ${parts.join(', ')}`)

      const sorted = [...buckets.entries()].sort((a, b) => b[1].length - a[1].length)

      for (const [type, items] of sorted) {
        console.log(`    ${type} (${items.length}):`)
        for (const item of items.slice(0, maxPerType)) {
          console.log(`      ${item.text}`)
        }
        if (items.length > maxPerType) {
          console.log(`      ... and ${items.length - maxPerType} more`)
        }
      }
    }


    const specBuckets = new Map<string, IssueEntry[]>()
    const storyBuckets = new Map<string, IssueEntry[]>()
    const schemaBuckets = new Map<string, IssueEntry[]>()

    function addToBucket(buckets: Map<string, IssueEntry[]>, type: string, entry: IssueEntry) {
      const bucket = buckets.get(type) ?? []
      bucket.push(entry)
      buckets.set(type, bucket)
    }

    const specTypes = new Set(['US↔Spec Mapping', 'Variant Coverage'])

    const schemaTypes = new Set(['Schema Path', 'API Schema Convention', 'API Schema Structure'])

    for (const f of analyzedFiles) {
      for (const issue of f.issues) {
        if (issue.type !== 'error' && issue.type !== 'warning') continue
        const type = specCodeLabels[issue.code] ?? 'Other'
        addToBucket(specBuckets, type, {
          severity: issue.type,
          text: formatIssue(issue.type, f.relativePath, issue.line, issue.message),
        })
      }
    }

    if (!skipStories) {
      for (const issue of storyResult?.issues ?? []) {
        if (issue.severity !== 'error' && issue.severity !== 'warning') continue
        const type = classifyStoryIssue(issue)
        const entry: IssueEntry = {
          severity: issue.severity,
          text: formatIssue(issue.severity, issue.file, issue.line, issue.message),
        }
        if (specTypes.has(type)) {
          addToBucket(specBuckets, type, entry)
        } else if (schemaTypes.has(type)) {
          addToBucket(schemaBuckets, type, entry)
        } else {
          addToBucket(storyBuckets, type, entry)
        }
      }
    }

    if (orphanedCount > 0) {
      const orphanEntries: IssueEntry[] = orphanedSpecIds.map((o) => ({
        severity: 'warning',
        text: `[WARN] ${o.file}:${o.line}: Spec ID "${o.specId}" not linked to any user story`,
      }))
      specBuckets.set('Orphaned Spec IDs', orphanEntries)
    }

    const schemaIssuesAll = storyResult?.schemaStructureIssues ?? earlySchemaIssues
    for (const issue of schemaIssuesAll) {
      if (issue.severity !== 'error' && issue.severity !== 'warning') continue
      const type = classifySchemaIssue(issue)
      const entry: IssueEntry = {
        severity: issue.severity,
        text: formatIssue(issue.severity, issue.file, issue.line, issue.message),
      }
      if (specTypes.has(type)) {
        addToBucket(specBuckets, type, entry)
      } else {
        addToBucket(schemaBuckets, type, entry)
      }
    }

    printTypeBuckets('Specs', specBuckets)
    printTypeBuckets('User Stories', storyBuckets)
    printTypeBuckets('Models / Schema', schemaBuckets)

    function generateWarningsMarkdown(
      sectors: { label: string; buckets: Map<string, IssueEntry[]> }[]
    ): string {
      const lines: string[] = []
      const timestamp = new Date().toISOString().substring(0, 16).replace('T', ' ')

      lines.push('# Content Quality Warnings')
      lines.push('')
      lines.push(
        `> Generated by \`bun run progress\` on ${timestamp} UTC. This file is regenerated on every run — do not edit manually.`
      )
      lines.push('')
      lines.push('## Summary')
      lines.push('')
      lines.push('| Sector | Errors | Warnings | Total |')
      lines.push('| ------ | ------ | -------- | ----- |')

      let grandErrors = 0
      let grandWarnings = 0
      for (const { label, buckets } of sectors) {
        const all = [...buckets.values()].flat()
        const errors = all.filter((i) => i.severity === 'error').length
        const warns = all.length - errors
        grandErrors += errors
        grandWarnings += warns
        if (all.length > 0) {
          lines.push(`| ${label} | ${errors} | ${warns} | ${all.length} |`)
        }
      }
      lines.push(
        `| **Total** | **${grandErrors}** | **${grandWarnings}** | **${grandErrors + grandWarnings}** |`
      )
      lines.push('')

      for (const { label, buckets } of sectors) {
        const all = [...buckets.values()].flat()
        if (all.length === 0) continue

        lines.push(`## ${label}`)
        lines.push('')

        const sorted = [...buckets.entries()].sort((a, b) => b[1].length - a[1].length)

        for (const [type, items] of sorted) {
          const errors = items.filter((i) => i.severity === 'error').length
          const warns = items.length - errors
          const parts: string[] = []
          if (errors > 0) parts.push(`${errors} error(s)`)
          if (warns > 0) parts.push(`${warns} warning(s)`)

          lines.push(`### ${type} (${parts.join(', ')})`)
          lines.push('')

          for (const item of items) {
            lines.push(`- ${item.text}`)
          }
          lines.push('')
        }
      }

      return lines.join('\n')
    }

    const warningsMd = generateWarningsMarkdown([
      { label: 'Specs', buckets: specBuckets },
      { label: 'User Stories', buckets: storyBuckets },
      { label: 'Models / Schema', buckets: schemaBuckets },
    ])
    const formattedWarnings = await prettier.format(warningsMd, {
      ...(await prettier.resolveConfig(WARNINGS_FILE)),
      parser: 'markdown',
    })
    await writeFile(WARNINGS_FILE, formattedWarnings)

    console.log('')
    console.log(sep)
    console.log(`Generated: ${OUTPUT_FILE}`)
    console.log(`Generated: ${WARNINGS_FILE}`)
    console.log(sep)
  } else {
    console.log('')
    console.log(sep)
    console.log('📊 Content Quality Summary')
    console.log(sep)

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

    if (tddAutomation.totalFixed > 0 || totalFixme > 0) {
      console.log('')
      console.log('  TDD Pipeline')
      console.log(
        `  Fixed (30d)         ${tddAutomation.totalFixed} (pipeline: ${tddAutomation.fixedByPipeline}, manual: ${tddAutomation.fixedManually})`
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

    try {
      await access(WARNINGS_FILE)
      await unlink(WARNINGS_FILE)
    } catch {
    }

    console.log('')
    console.log(sep)
    console.log(`Generated: ${OUTPUT_FILE}`)
    console.log(sep)
  }

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

  if (verifyProgress) {
    console.log('')
    console.log(wideSep)
    console.log('GitHub Verification')
    console.log(wideSep)
    console.log('')

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

  console.log('')
  if (hasErrors) {
    console.log(`❌ Content quality failed: ${totalErrors} error(s), ${totalWarnings} warning(s)`)
    if (!noError) {
      process.exit(1)
    }
    console.log('   (--no-error: continuing without exit code 1)')
  } else if (hasWarnings) {
    console.log(`⚠️  Content quality passed with warnings: ${totalWarnings} warning(s)`)
  } else {
    console.log('✅ All content quality checks passed!')
  }

  if (strictMode && !noError) {
    const totalStrictIssues = totalWarnings + suggestionsWithDuplicates
    if (totalStrictIssues > 0) {
      console.log(
        `   ❌ Strict mode: ${totalWarnings} warning(s), ${suggestionsWithDuplicates} suggestion(s)`
      )
      process.exit(1)
    }
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { SPEC_ID_PATTERN, isRegressionSpecId }
