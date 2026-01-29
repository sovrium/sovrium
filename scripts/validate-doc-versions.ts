/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Version Validation Script
 *
 * This script validates that all version numbers mentioned in documentation files
 * match the actual versions in package.json. It prevents documentation drift by
 * catching version mismatches early in the development workflow.
 *
 * Usage:
 *   bun run scripts/validate-doc-versions.ts
 *   bun run validate:docs:versions
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { exit } from 'process'

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
}

interface PackageVersion {
  name: string
  version: string
}

interface ValidationError {
  file: string
  package: string
  documented: string
  actual: string
  lineNumber?: number
}

// Load package.json
const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'))

// Define critical packages to validate
const packagesToValidate: PackageVersion[] = [
  { name: 'bun', version: packageJson.packageManager?.match(/bun@([\d.]+)/)?.[1] || '' },
  { name: 'effect', version: packageJson.dependencies.effect?.replace(/^\^/, '') || '' },
  { name: 'hono', version: packageJson.dependencies.hono?.replace(/^\^/, '') || '' },
  { name: 'zod', version: packageJson.dependencies.zod?.replace(/^\^/, '') || '' },
  {
    name: 'better-auth',
    version: packageJson.dependencies['better-auth']?.replace(/^\^/, '') || '',
  },
  {
    name: 'drizzle-orm',
    version: packageJson.dependencies['drizzle-orm']?.replace(/^\^/, '') || '',
  },
  { name: 'react', version: packageJson.dependencies.react?.replace(/^\^/, '') || '' },
  { name: 'react-dom', version: packageJson.dependencies['react-dom']?.replace(/^\^/, '') || '' },
  { name: 'tailwindcss', version: packageJson.dependencies.tailwindcss?.replace(/^\^/, '') || '' },
  {
    name: '@tanstack/react-query',
    version: packageJson.dependencies['@tanstack/react-query']?.replace(/^\^/, '') || '',
  },
  {
    name: '@tanstack/react-table',
    version: packageJson.dependencies['@tanstack/react-table']?.replace(/^\^/, '') || '',
  },
  {
    name: '@effect/language-service',
    version: packageJson.devDependencies['@effect/language-service']?.replace(/^\^/, '') || '',
  },
  { name: 'typescript', version: packageJson.devDependencies.typescript?.replace(/^\^/, '') || '' },
]

// Documentation files to check
const docsToValidate = [
  'CLAUDE.md',
  'docs/infrastructure/runtime/bun.md',
  'docs/infrastructure/language/typescript.md',
  'docs/infrastructure/framework/effect.md',
  'docs/infrastructure/framework/hono.md',
  'docs/infrastructure/api/zod-hono-openapi.md',
  'docs/infrastructure/framework/better-auth.md',
  'docs/infrastructure/database/drizzle.md',
  'docs/infrastructure/ui/react.md',
  'docs/infrastructure/ui/tailwind.md',
  'docs/infrastructure/ui/tanstack-query.md',
  'docs/infrastructure/ui/tanstack-table.md',
]

/**
 * Extract version mentions from documentation content
 */
function extractVersionMentions(
  content: string,
  packageName: string
): Array<{ version: string; line: number }> {
  const lines = content.split('\n')
  const mentions: Array<{ version: string; line: number }> = []

  // Build regex patterns for the package
  const patterns = [
    // **Version**: ^X.Y.Z or **Version**: X.Y.Z
    new RegExp(`\\*\\*Version\\*\\*:\\s+\\^?(\\d+\\.\\d+\\.\\d+)`, 'i'),
    // | **PackageName** | ^X.Y.Z | or | **PackageName** | X.Y.Z |
    new RegExp(
      `\\|\\s*\\*\\*${escapeRegex(packageName)}\\*\\*\\s*\\|\\s+\\^?(\\d+\\.\\d+\\.\\d+)`,
      'i'
    ),
    // bun@X.Y.Z (for Bun in packageManager)
    packageName === 'bun' ? new RegExp(`bun@(\\d+\\.\\d+\\.\\d+)`, 'g') : null,
    // "package": "^X.Y.Z" in code blocks
    new RegExp(`"${escapeRegex(packageName)}":\\s*"\\^?(\\d+\\.\\d+\\.\\d+)"`, 'g'),
  ].filter(Boolean) as RegExp[]

  lines.forEach((line, index) => {
    patterns.forEach((pattern) => {
      const matches = pattern.global ? [...line.matchAll(pattern)] : [line.match(pattern)]
      matches.forEach((match) => {
        if (match && match[1]) {
          mentions.push({ version: match[1], line: index + 1 })
        }
      })
    })
  })

  return mentions
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Validate all documentation files
 */
function validateDocumentation(): ValidationError[] {
  const errors: ValidationError[] = []

  console.log(`${colors.blue}${colors.bold}Validating documentation versions...${colors.reset}\n`)

  for (const docFile of docsToValidate) {
    const filePath = join(process.cwd(), docFile)
    let content: string

    try {
      content = readFileSync(filePath, 'utf-8')
    } catch (error) {
      console.log(`${colors.yellow}⚠️  Skipping ${docFile} (file not found)${colors.reset}`)
      continue
    }

    console.log(`${colors.blue}Checking ${docFile}...${colors.reset}`)

    for (const { name, version: actualVersion } of packagesToValidate) {
      if (!actualVersion) continue

      const mentions = extractVersionMentions(content, name)

      for (const { version: documentedVersion, line } of mentions) {
        // Skip if documented version matches actual version
        if (documentedVersion === actualVersion) {
          console.log(`  ${colors.green}✓${colors.reset} ${name}: ${documentedVersion}`)
          continue
        }

        // Skip if documented version is older but uses ^ (allows minor/patch updates)
        const docParts = documentedVersion.split('.').map(Number)
        const actualParts = actualVersion.split('.').map(Number)

        // Check if documented version is compatible (major version matches)
        if (docParts[0] === actualParts[0]) {
          console.log(
            `  ${colors.yellow}⚠${colors.reset} ${name}: ${documentedVersion} (actual: ${actualVersion}) - compatible but outdated`
          )
          continue
        }

        // Version mismatch found
        errors.push({
          file: docFile,
          package: name,
          documented: documentedVersion,
          actual: actualVersion,
          lineNumber: line,
        })

        console.log(
          `  ${colors.red}✗${colors.reset} ${name}: ${documentedVersion} → should be ${actualVersion} (line ${line})`
        )
      }
    }

    console.log()
  }

  return errors
}

/**
 * Print validation results
 */
function printResults(errors: ValidationError[]): void {
  if (errors.length === 0) {
    console.log(
      `${colors.green}${colors.bold}✓ All documentation versions are up to date!${colors.reset}`
    )
    exit(0)
  }

  console.log(
    `${colors.red}${colors.bold}✗ Found ${errors.length} version mismatch${errors.length > 1 ? 'es' : ''}:${colors.reset}\n`
  )

  // Group errors by file
  const errorsByFile = errors.reduce(
    (acc, error) => {
      if (!acc[error.file]) acc[error.file] = []
      acc[error.file].push(error)
      return acc
    },
    {} as Record<string, ValidationError[]>
  )

  for (const [file, fileErrors] of Object.entries(errorsByFile)) {
    console.log(`${colors.bold}${file}:${colors.reset}`)
    for (const error of fileErrors) {
      console.log(
        `  ${colors.red}✗${colors.reset} ${error.package}: ${error.documented} → ${error.actual}${error.lineNumber ? ` (line ${error.lineNumber})` : ''}`
      )
    }
    console.log()
  }

  console.log(`${colors.yellow}Run the following commands to update versions:${colors.reset}`)
  console.log(`  ${colors.blue}bun run scripts/sync-doc-versions.ts${colors.reset} (auto-fix)`)
  console.log(`  ${colors.blue}or manually update the files listed above${colors.reset}`)
  console.log()

  exit(1)
}

// Run validation
const errors = validateDocumentation()
printResults(errors)
