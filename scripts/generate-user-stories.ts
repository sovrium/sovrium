/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * User Story Generator
 *
 * Generates user story files in docs/user-stories/ that link ALL spec IDs
 * from the E2E test suite. Each spec file maps 1:1 to a user story file.
 *
 * Usage:
 *   bun run scripts/generate-user-stories.ts [options]
 *
 * Options:
 *   --dry-run    Preview what would be generated without writing files
 *   --verbose    Show detailed output during generation
 *
 * Output:
 *   - Creates docs/user-stories/as-developer/{domain}/{feature}.md files
 *   - Each file links to corresponding spec IDs from specs/{domain}/{feature}.spec.ts
 */

import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { join, dirname, basename, relative } from 'node:path'
import * as prettier from 'prettier'

// =============================================================================
// Types
// =============================================================================

interface SpecTest {
  id: string
  name: string
  tag: '@spec' | '@regression'
  lineNumber: number
  isFixme: boolean
  description: string
}

interface SpecFileData {
  path: string
  relativePath: string
  domain: string
  feature: string
  subFeature: string | null
  tests: SpecTest[]
  totalSpecs: number
  totalRegression: number
  passingTests: number
  fixmeTests: number
}

// =============================================================================
// Configuration
// =============================================================================

const SPECS_DIR = 'specs'
const OUTPUT_DIR = 'docs/user-stories'
const SCHEMA_DIR = 'src/domain/models/app'

// Domain to schema mapping
const DOMAIN_SCHEMA_MAP: Record<string, string | null> = {
  api: null, // API tests don't have direct schema - they test endpoints
  app: null, // App tests map to various schemas
  cli: null, // CLI has no schema
  migrations: null, // Migrations are schema-independent
  templates: null, // Templates have no schema
}

// Sub-domain to schema mapping (more specific)
const SUBDOMAIN_SCHEMA_MAP: Record<string, string> = {
  'app/tables': 'table',
  'app/theme': 'theme',
  'app/pages': 'page',
  'app/blocks': 'blocks',
  'app/languages': 'languages',
  'api/auth': 'auth',
  'api/tables': 'table',
}

// =============================================================================
// Spec File Parsing
// =============================================================================

async function findSpecFiles(dir: string): Promise<string[]> {
  const files: string[] = []

  async function walk(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)

      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.name.endsWith('.spec.ts')) {
        files.push(fullPath)
      }
    }
  }

  await walk(dir)
  return files.sort()
}

function parseSpecFile(content: string, _relativePath: string): SpecTest[] {
  const tests: SpecTest[] = []

  // Pattern to match test declarations with spec IDs
  // e.g., test('API-AUTH-SIGN-UP-EMAIL-001: should create user', ...)
  const testPattern =
    /test(?:\.fixme)?\s*\(\s*['"`]([A-Z]+-[A-Z0-9-]+-(?:\d{3}|REGRESSION)):\s*(.+?)['"`]/g

  let match
  while ((match = testPattern.exec(content)) !== null) {
    const specId = match[1]!
    const description = match[2]!.trim()
    const lineNumber = content.substring(0, match.index).split('\n').length

    // Check if it's a fixme test
    const isFixme = content.substring(match.index - 20, match.index).includes('.fixme')

    // Determine tag from spec ID
    const tag: '@spec' | '@regression' = specId.endsWith('-REGRESSION') ? '@regression' : '@spec'

    tests.push({
      id: specId,
      name: `${specId}: ${description}`,
      tag,
      lineNumber,
      isFixme,
      description,
    })
  }

  return tests
}

function extractDomainFeature(relativePath: string): {
  domain: string
  feature: string
  subFeature: string | null
} {
  // Remove 'specs/' prefix and '.spec.ts' suffix
  const cleanPath = relativePath.replace(/^specs\//, '').replace(/\.spec\.ts$/, '')
  const parts = cleanPath.split('/')

  const domain = parts[0] || 'unknown'
  const feature = parts.slice(1, -1).join('/') || parts[1] || basename(cleanPath) || 'unknown'
  const subFeature = parts.length > 2 ? (parts[parts.length - 1] ?? null) : null

  return { domain, feature: feature || basename(cleanPath), subFeature }
}

function getSchemaPath(domain: string, feature: string): string | null {
  const key = `${domain}/${feature.split('/')[0]}`

  if (SUBDOMAIN_SCHEMA_MAP[key]) {
    return `${SCHEMA_DIR}/${SUBDOMAIN_SCHEMA_MAP[key]}/`
  }

  return DOMAIN_SCHEMA_MAP[domain] ? `${SCHEMA_DIR}/${DOMAIN_SCHEMA_MAP[domain]}/` : null
}

async function analyzeSpecFiles(): Promise<SpecFileData[]> {
  const specFiles = await findSpecFiles(SPECS_DIR)
  const results: SpecFileData[] = []

  for (const filePath of specFiles) {
    const content = await readFile(filePath, 'utf-8')
    const relativePath = relative(process.cwd(), filePath)
    const tests = parseSpecFile(content, relativePath)

    if (tests.length === 0) {
      console.warn(`⚠️ No tests found in ${relativePath}`)
      continue
    }

    const { domain, feature, subFeature } = extractDomainFeature(relativePath)

    results.push({
      path: filePath,
      relativePath: relativePath.replace(/^specs\//, ''),
      domain,
      feature,
      subFeature,
      tests,
      totalSpecs: tests.filter((t) => t.tag === '@spec').length,
      totalRegression: tests.filter((t) => t.tag === '@regression').length,
      passingTests: tests.filter((t) => !t.isFixme).length,
      fixmeTests: tests.filter((t) => t.isFixme).length,
    })
  }

  return results
}

// =============================================================================
// User Story Generation
// =============================================================================

function generateUserStoryId(domain: string, feature: string, index: number): string {
  // Convert feature path to ID format
  // e.g., "tables/field-types/email-field" -> "TABLES-FIELDS-EMAIL"
  // e.g., "activity/{activityId}/get" -> "ACTIVITY-ID-GET"
  const featureParts = feature.split('/').map((p) =>
    p
      .replace(/\{[^}]+\}/g, 'ID') // Replace {param} with ID
      .replace(/-field$/, '')
      .replace(/field-types/, 'FIELDS')
      .toUpperCase()
      .replace(/-/g, '-')
  )

  const featureId = featureParts.join('-').substring(0, 30) // Limit length

  return `US-${domain.toUpperCase()}-${featureId}-${String(index).padStart(3, '0')}`
}

function generateTitle(specFile: SpecFileData): string {
  // Generate a human-readable title from the feature path
  const parts = specFile.feature.split('/')
  const lastPart = parts[parts.length - 1] || specFile.feature

  return lastPart
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function generateUserStoryContent(specFile: SpecFileData): string {
  const title = generateTitle(specFile)
  const userStoryId = generateUserStoryId(specFile.domain, specFile.feature, 1)
  const schemaPath = getSchemaPath(specFile.domain, specFile.feature)

  const specTests = specFile.tests.filter((t) => t.tag === '@spec')
  const regressionTests = specFile.tests.filter((t) => t.tag === '@regression')

  // Calculate status
  const allPassing = specFile.fixmeTests === 0
  const status = allPassing ? '`[x]` Complete' : `\`[~]\` Partial (${specFile.fixmeTests} fixme)`

  // Determine schema name for the table
  const schemaName = schemaPath ? schemaPath.split('/').slice(-2, -1)[0] || '' : ''

  let content = `# ${specFile.domain.toUpperCase()} > ${title}

> **Domain**: ${specFile.domain}
> **Feature Area**: ${specFile.feature}${specFile.subFeature ? ` > ${specFile.subFeature}` : ''}
> **Role**: Developer
> **Spec File**: \`specs/${specFile.relativePath}\`
${schemaPath ? `> **Schema Path**: \`${schemaPath}\`` : ''}
> **Total Specs**: ${specFile.totalSpecs} @spec + ${specFile.totalRegression} @regression

---

## User Stories

### ${userStoryId}: ${title}

**Story**: As a developer, I want to validate ${title.toLowerCase()} behavior so that the feature works correctly.

**Status**: ${status}

#### Acceptance Criteria

| ID | Criterion | Spec Test ID | Schema | Status |
|----|-----------|--------------|--------|--------|
`

  // Add acceptance criteria from @spec tests
  specTests.forEach((test, index) => {
    const acId = `AC-${String(index + 1).padStart(3, '0')}`
    const testStatus = test.isFixme ? '`[ ]`' : '`[x]`'
    // Use HTML entity for pipe to avoid breaking markdown table
    const criterion = test.description.replace(/\|/g, '&#124;')

    content += `| ${acId} | ${criterion} | \`${test.id}\` | ${schemaName} | ${testStatus} |\n`
  })

  // Add regression tests as acceptance criteria (so analyzer can find them)
  const specTestCount = specTests.length
  regressionTests.forEach((test, index) => {
    const acId = `AC-${String(specTestCount + index + 1).padStart(3, '0')}`
    const testStatus = test.isFixme ? '`[ ]`' : '`[x]`'
    // Use HTML entity for pipe to avoid breaking markdown table
    const criterion = test.description.replace(/\|/g, '&#124;')

    content += `| ${acId} | ${criterion} | \`${test.id}\` | ${schemaName} | ${testStatus} |\n`
  })

  // Add implementation notes
  content += `
#### Implementation Notes

- **Spec File**: \`specs/${specFile.relativePath}\` ✅
${schemaPath ? `- **Schema**: \`${schemaPath}\` ✅` : '- **Schema**: N/A (no direct schema mapping)'}
- **Tests**: ${specFile.passingTests}/${specFile.tests.length} passing`

  // Add coverage summary
  content += `
---

## Coverage Summary

| Story ID | Title | Status | Criteria Met |
|----------|-------|--------|--------------|
| ${userStoryId} | ${title} | ${status} | ${specFile.passingTests}/${specTests.length} |
`

  return content
}

function generateReadmeContent(domain: string, files: SpecFileData[]): string {
  const domainTitle = domain.charAt(0).toUpperCase() + domain.slice(1)

  // Group files by feature area
  const featureGroups = new Map<string, SpecFileData[]>()
  for (const file of files) {
    const featureArea = file.feature.split('/')[0] || file.feature
    if (!featureGroups.has(featureArea)) {
      featureGroups.set(featureArea, [])
    }
    featureGroups.get(featureArea)!.push(file)
  }

  let content = `# ${domainTitle} Domain Specifications

> User stories for the **${domain}** domain.

## Overview

| Metric | Value |
|--------|-------|
| **Total Spec Files** | ${files.length} |
| **Total Spec IDs** | ${files.reduce((sum, f) => sum + f.totalSpecs, 0)} |
| **Passing Tests** | ${files.reduce((sum, f) => sum + f.passingTests, 0)} |
| **Fixme Tests** | ${files.reduce((sum, f) => sum + f.fixmeTests, 0)} |

## Feature Areas

`

  for (const [featureArea, featureFiles] of featureGroups) {
    const featureTitle = featureArea
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

    content += `### ${featureTitle}

| Feature | Specs | Passing | Status |
|---------|-------|---------|--------|
`

    for (const file of featureFiles) {
      const title = generateTitle(file)
      const status = file.fixmeTests === 0 ? '🟢' : '🟡'
      const link = `./${file.feature}/as-developer.md`

      content += `| [${title}](${link}) | ${file.totalSpecs} | ${file.passingTests}/${file.tests.length} | ${status} |\n`
    }

    content += '\n'
  }

  return content
}

// =============================================================================
// File Operations
// =============================================================================

async function deleteExistingUserStories(): Promise<void> {
  const domains = [
    'admin-space',
    'analytics',
    'api',
    'auth',
    'automations',
    'forms',
    'integrations',
    'pages',
    'tables',
    'theme',
  ]

  for (const domain of domains) {
    const domainPath = join(OUTPUT_DIR, domain)
    try {
      await rm(domainPath, { recursive: true, force: true })
      console.log(`🗑️ Deleted ${domainPath}`)
    } catch {
      // Directory doesn't exist, that's fine
    }
  }
}

async function writeUserStoryFiles(
  specFiles: SpecFileData[],
  dryRun: boolean
): Promise<{ created: number; errors: string[] }> {
  let created = 0
  const errors: string[] = []

  // Group by domain
  const byDomain = new Map<string, SpecFileData[]>()
  for (const file of specFiles) {
    if (!byDomain.has(file.domain)) {
      byDomain.set(file.domain, [])
    }
    byDomain.get(file.domain)!.push(file)
  }

  // Generate files for each domain
  for (const [domain, files] of byDomain) {
    // Create domain README
    const readmeContent = generateReadmeContent(domain, files)
    const readmePath = join(OUTPUT_DIR, domain, 'README.md')

    if (!dryRun) {
      await mkdir(dirname(readmePath), { recursive: true })
      const formatted = await prettier.format(readmeContent, { parser: 'markdown' })
      await writeFile(readmePath, formatted)
    }
    console.log(`📄 ${dryRun ? '[DRY-RUN] Would create' : 'Created'} ${readmePath}`)
    created++

    // Create user story files
    for (const file of files) {
      // Use the full spec path to create unique output directories
      // e.g., specs/app/tables/field-types/email-field.spec.ts → app/tables/field-types/email-field/as-developer.md
      const specPathWithoutExt = file.relativePath.replace(/\.spec\.ts$/, '')
      const outputPath = join(OUTPUT_DIR, specPathWithoutExt, 'as-developer.md')
      const content = generateUserStoryContent(file)

      if (!dryRun) {
        await mkdir(dirname(outputPath), { recursive: true })
        try {
          const formatted = await prettier.format(content, { parser: 'markdown' })
          await writeFile(outputPath, formatted)
        } catch {
          // If prettier fails, write unformatted
          await writeFile(outputPath, content)
        }
      }
      console.log(`📄 ${dryRun ? '[DRY-RUN] Would create' : 'Created'} ${outputPath}`)
      created++
    }
  }

  return { created, errors }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const argsSet = new Set(process.argv.slice(2))
  const dryRun = argsSet.has('--dry-run')
  const verbose = argsSet.has('--verbose')

  console.log('🔍 Analyzing spec files...\n')

  // Step 1: Analyze all spec files
  const specFiles = await analyzeSpecFiles()

  console.log(
    `\n📊 Found ${specFiles.length} spec files with ${specFiles.reduce((sum, f) => sum + f.tests.length, 0)} tests\n`
  )

  if (verbose) {
    console.log('Domains:')
    const byDomain = new Map<string, number>()
    for (const file of specFiles) {
      byDomain.set(file.domain, (byDomain.get(file.domain) || 0) + 1)
    }
    for (const [domain, count] of byDomain) {
      console.log(`  - ${domain}: ${count} files`)
    }
    console.log('')
  }

  // Step 2: Delete existing user stories (except README.md in root)
  if (!dryRun) {
    console.log('🗑️ Deleting existing user story files...\n')
    await deleteExistingUserStories()
  }

  // Step 3: Generate new user story files
  console.log(`\n📝 ${dryRun ? '[DRY-RUN] Generating' : 'Generating'} user story files...\n`)
  const { created, errors } = await writeUserStoryFiles(specFiles, dryRun)

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 Summary')
  console.log('='.repeat(60))
  console.log(`   Spec files analyzed: ${specFiles.length}`)
  console.log(`   Total spec IDs: ${specFiles.reduce((sum, f) => sum + f.totalSpecs, 0)}`)
  console.log(`   User story files ${dryRun ? 'would be ' : ''}created: ${created}`)

  if (errors.length > 0) {
    console.log(`\n❌ Errors (${errors.length}):`)
    errors.forEach((err) => console.log(`   - ${err}`))
  }

  if (dryRun) {
    console.log('\n💡 Run without --dry-run to actually generate files')
  } else {
    console.log('\n✅ User stories generated successfully!')
    console.log('   Run `bun run analyze:specs` to verify coverage')
  }
}

main().catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})
