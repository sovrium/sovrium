#!/usr/bin/env bun

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

interface Issue {
  file: string
  line?: number
  type: string
  message: string
}

const issues: Issue[] = []

async function getSpecFiles(): Promise<string[]> {
  const directories = [
    'specs/api/auth/organization/teams',
    'specs/api/auth/organization/dynamic-roles',
    'specs/api/auth/organization/options',
    'specs/api/auth/api-key',
    'specs/api/auth/admin',
  ]

  const files: string[] = []

  async function walkDir(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walkDir(fullPath)
      } else if (entry.name.endsWith('.spec.ts')) {
        files.push(fullPath)
      }
    }
  }

  for (const dir of directories) {
    await walkDir(dir)
  }

  return files.sort()
}

function checkCopyrightHeader(content: string, file: string): void {
  const expectedHeader = `/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */`

  if (!content.startsWith(expectedHeader)) {
    issues.push({
      file,
      line: 1,
      type: 'copyright',
      message: 'Missing or incorrect copyright header',
    })
  }
}

function checkImports(content: string, file: string): void {
  const lines = content.split('\n')
  let foundCorrectImport = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes('import') && line.includes('test')) {
      if (line === "import { test } from '@/specs/fixtures'") {
        foundCorrectImport = true
      } else if (line.includes('expect')) {
        issues.push({
          file,
          line: i + 1,
          type: 'import',
          message: 'Should not import expect from fixtures (test only)',
        })
      }
    }
  }

  if (!foundCorrectImport) {
    issues.push({
      file,
      type: 'import',
      message: "Missing correct import: import { test } from '@/specs/fixtures'",
    })
  }
}

function checkSpecIDs(content: string, file: string): void {
  const lines = content.split('\n')
  const specIDPattern = /API-AUTH-[A-Z-]+-\d{3}/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (
      line.includes('test.fixme(') ||
      (line.trim().startsWith('test(') && !line.includes('test.step('))
    ) {
      // Check current line and next few lines for spec ID
      const contextLines = lines.slice(i, i + 3).join('\n')
      if (!specIDPattern.test(contextLines)) {
        issues.push({
          file,
          line: i + 1,
          type: 'spec-id',
          message: 'Missing or malformed spec ID (should be API-AUTH-{FEATURE}-{NUMBER})',
        })
      }
    }
  }
}

function checkTestStructure(content: string, file: string): void {
  const testFixmeCount = (content.match(/test\.fixme\(/g) || []).length
  const testCount = (content.match(/test\(/g) || []).length - testFixmeCount

  if (testCount > 0) {
    issues.push({
      file,
      type: 'test-structure',
      message: `Found ${testCount} test() calls - should use test.fixme()`,
    })
  }

  const specTests = (content.match(/tag: '@spec'/g) || []).length
  const regressionTests = (content.match(/tag: '@regression'/g) || []).length

  if (specTests !== 6) {
    issues.push({
      file,
      type: 'test-structure',
      message: `Expected 6 @spec tests, found ${specTests}`,
    })
  }

  if (regressionTests !== 1) {
    issues.push({
      file,
      type: 'test-structure',
      message: `Expected 1 @regression test, found ${regressionTests}`,
    })
  }
}

function checkGivenWhenThen(content: string, file: string): void {
  const lines = content.split('\n')
  let inSpecTest = false
  let testStartLine = 0
  let hasGiven = false
  let hasWhen = false
  let hasThen = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.includes("tag: '@spec'")) {
      inSpecTest = true
      testStartLine = i
      hasGiven = false
      hasWhen = false
      hasThen = false
    }

    if (inSpecTest) {
      if (line.includes('// GIVEN:') && !line.includes('TODO')) hasGiven = true
      if (line.includes('// WHEN:') && !line.includes('TODO')) hasWhen = true
      if (line.includes('// THEN:') && !line.includes('TODO')) hasThen = true
    }

    if (inSpecTest && line.trim() === '})') {
      if (!hasGiven || !hasWhen || !hasThen) {
        issues.push({
          file,
          line: testStartLine + 1,
          type: 'given-when-then',
          message:
            "Missing real GIVEN/WHEN/THEN comments in @spec test (TODO placeholders don't count)",
        })
      }
      inSpecTest = false
    }
  }
}

function checkPlaceholders(content: string, file: string): void {
  const lines = content.split('\n')
  const placeholderPatterns = [/TODO/i, /FIXME/i, /XXX/i, /placeholder/i, /\.\.\./]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const pattern of placeholderPatterns) {
      if (pattern.test(line) && !line.includes('test.fixme')) {
        issues.push({
          file,
          line: i + 1,
          type: 'placeholder',
          message: `Found placeholder/TODO in line: ${line.trim()}`,
        })
      }
    }
  }
}

async function reviewFile(file: string): Promise<void> {
  const content = await readFile(file, 'utf-8')

  checkCopyrightHeader(content, file)
  checkImports(content, file)
  checkSpecIDs(content, file)
  checkTestStructure(content, file)
  checkGivenWhenThen(content, file)
  checkPlaceholders(content, file)
}

async function main() {
  console.log('🔍 Reviewing Better Auth spec files...\n')

  const files = await getSpecFiles()
  console.log(`Found ${files.length} spec files to review\n`)

  for (const file of files) {
    await reviewFile(file)
  }

  if (issues.length === 0) {
    console.log('✅ All spec files passed review!\n')
    process.exit(0)
  }

  console.log(`❌ Found ${issues.length} issues:\n`)

  const issuesByFile = new Map<string, Issue[]>()
  for (const issue of issues) {
    if (!issuesByFile.has(issue.file)) {
      issuesByFile.set(issue.file, [])
    }
    issuesByFile.get(issue.file)!.push(issue)
  }

  for (const [file, fileIssues] of issuesByFile) {
    console.log(`📄 ${file}`)
    for (const issue of fileIssues) {
      const location = issue.line ? `:${issue.line}` : ''
      console.log(`  ${issue.type}${location}: ${issue.message}`)
    }
    console.log()
  }

  const issuesByType = new Map<string, number>()
  for (const issue of issues) {
    issuesByType.set(issue.type, (issuesByType.get(issue.type) || 0) + 1)
  }

  console.log('\n📊 Issue Summary:')
  for (const [type, count] of issuesByType) {
    console.log(`  ${type}: ${count}`)
  }
  console.log()

  process.exit(1)
}

main()
