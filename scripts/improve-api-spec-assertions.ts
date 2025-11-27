/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Script to improve API spec assertions from generic placeholders
 * to proper schema-based assertions.
 *
 * Usage: bun run scripts/improve-api-spec-assertions.ts [--dry-run]
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const API_SPECS_DIR = 'specs/api'

// Map endpoint patterns to expected response assertions
const ASSERTION_PATTERNS: Record<string, string> = {
  // Auth sign-in/sign-up responses
  'sign-in/email': `expect(data).toHaveProperty('user')
      expect(data).toHaveProperty('session')`,
  'sign-up/email': `expect(data).toHaveProperty('user')`,
  'sign-out': `expect(data).toMatchObject({ success: true })`,

  // Session endpoints
  'session/list': `expect(data).toHaveProperty('sessions')
      expect(Array.isArray(data.sessions)).toBe(true)`,
  'session/get': `expect(data).toHaveProperty('session')
      expect(data).toHaveProperty('user')`,
  'session/revoke': `expect(data).toMatchObject({ success: true })`,

  // Admin endpoints
  'admin/list-users': `expect(data).toHaveProperty('users')
      expect(Array.isArray(data.users)).toBe(true)`,
  'admin/get-user': `expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('id')
      expect(data.user).toHaveProperty('email')`,
  'admin/create-user': `expect(data).toHaveProperty('user')`,
  'admin/ban-user': `expect(data).toHaveProperty('user')
      expect(data.user.banned).toBe(true)`,
  'admin/unban-user': `expect(data).toHaveProperty('user')
      expect(data.user.banned).toBe(false)`,
  'admin/set-role': `expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('role')`,

  // Organization endpoints
  'organization/create': `expect(data).toHaveProperty('organization')
      expect(data.organization).toHaveProperty('id')
      expect(data.organization).toHaveProperty('name')`,
  'organization/get': `expect(data).toHaveProperty('organization')`,
  'organization/list': `expect(data).toHaveProperty('organizations')
      expect(Array.isArray(data.organizations)).toBe(true)`,
  'organization/update': `expect(data).toHaveProperty('organization')`,
  'organization/delete': `expect(data).toMatchObject({ success: true })`,
  'organization/list-members': `expect(data).toHaveProperty('members')
      expect(Array.isArray(data.members)).toBe(true)`,
  'organization/add-member': `expect(data).toHaveProperty('member')`,
  'organization/remove-member': `expect(data).toMatchObject({ success: true })`,
  'organization/invite-member': `expect(data).toHaveProperty('invitation')`,
  'organization/accept-invitation': `expect(data).toHaveProperty('member')`,
  'organization/cancel-invitation': `expect(data).toMatchObject({ success: true })`,

  // Password endpoints
  'password/forgot': `expect(data).toMatchObject({ success: true })`,
  'password/reset': `expect(data).toMatchObject({ success: true })`,
  'password/change': `expect(data).toMatchObject({ success: true })`,

  // Verification endpoints
  'verification/email': `expect(data).toHaveProperty('user')`,
  'verification/send-email': `expect(data).toMatchObject({ success: true })`,

  // Table endpoints
  'tables/list': `expect(data).toHaveProperty('tables')
      expect(Array.isArray(data.tables)).toBe(true)`,
  'tables/get': `expect(data).toHaveProperty('table')
      expect(data.table).toHaveProperty('id')
      expect(data.table).toHaveProperty('fields')`,
  'tables/permissions': `expect(data).toHaveProperty('permissions')`,

  // Record endpoints
  'records/list': `expect(data).toHaveProperty('records')
      expect(Array.isArray(data.records)).toBe(true)`,
  'records/get': `expect(data).toHaveProperty('record')`,
  'records/create': `expect(data).toHaveProperty('record')
      expect(data.record).toHaveProperty('id')`,
  'records/update': `expect(data).toHaveProperty('record')`,
  'records/delete': `expect(data).toMatchObject({ success: true })`,
  'records/batch/create': `expect(data).toHaveProperty('records')
      expect(data).toHaveProperty('count')`,
  'records/batch/update': `expect(data).toHaveProperty('records')
      expect(data).toHaveProperty('count')`,
  'records/batch/delete': `expect(data).toMatchObject({ success: true })
      expect(data).toHaveProperty('count')`,
  'records/upsert': `expect(data).toHaveProperty('records')
      expect(data).toHaveProperty('created')
      expect(data).toHaveProperty('updated')`,

  // View endpoints
  'views/list': `expect(data).toHaveProperty('views')
      expect(Array.isArray(data.views)).toBe(true)`,
  'views/get': `expect(data).toHaveProperty('view')`,
  'views/records': `expect(data).toHaveProperty('records')
      expect(Array.isArray(data.records)).toBe(true)`,

  // Error responses (4xx status codes)
  '400': `expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')`,
  '401': `expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')`,
  '403': `expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')`,
  '404': `expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')`,
}

// Placeholder pattern to replace
const PLACEHOLDER_PATTERN =
  /expect\(data\)\.toMatchObject\(\{ success: expect\.any\(Boolean\) \}\)/g

async function findSpecFiles(dir: string): Promise<string[]> {
  const files: string[] = []

  async function walk(currentDir: string): Promise<void> {
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
  return files
}

function getAssertionForPath(filePath: string): string | undefined {
  // Extract the endpoint pattern from the file path
  const relativePath = filePath.replace(API_SPECS_DIR + '/', '').replace('.spec.ts', '')

  // Try exact match first
  for (const [pattern, assertion] of Object.entries(ASSERTION_PATTERNS)) {
    if (relativePath.includes(pattern)) {
      return assertion
    }
  }

  return undefined
}

function determineErrorAssertion(content: string): string | undefined {
  // Check status code expectations to determine error type
  if (content.includes('status).toBe(400)') || content.includes('status()).toBe(400)')) {
    return ASSERTION_PATTERNS['400']
  }
  if (content.includes('status).toBe(401)') || content.includes('status()).toBe(401)')) {
    return ASSERTION_PATTERNS['401']
  }
  if (content.includes('status).toBe(403)') || content.includes('status()).toBe(403)')) {
    return ASSERTION_PATTERNS['403']
  }
  if (content.includes('status).toBe(404)') || content.includes('status()).toBe(404)')) {
    return ASSERTION_PATTERNS['404']
  }
  return undefined
}

async function improveFile(
  filePath: string,
  dryRun: boolean
): Promise<{ path: string; improved: boolean; replacements: number }> {
  const content = await readFile(filePath, 'utf-8')

  if (!PLACEHOLDER_PATTERN.test(content)) {
    return { path: filePath, improved: false, replacements: 0 }
  }

  const successAssertion = getAssertionForPath(filePath)
  const errorAssertion = determineErrorAssertion(content)

  let replacements = 0

  // Split content into test blocks and process each
  const lines = content.split('\n')
  const result: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''

    if (line.match(PLACEHOLDER_PATTERN)) {
      // Determine if this is in an error test context
      let isErrorContext = false
      // Look back up to 20 lines for status code context
      for (let j = Math.max(0, i - 20); j < i; j++) {
        const contextLine = lines[j] ?? ''
        if (
          contextLine.includes('status).toBe(4') ||
          contextLine.includes('status()).toBe(4') ||
          contextLine.includes('status).toBe(5') ||
          contextLine.includes('status()).toBe(5')
        ) {
          isErrorContext = true
          break
        }
      }

      const assertion = isErrorContext ? errorAssertion : successAssertion

      if (assertion) {
        // Replace placeholder with proper assertion
        const indentation = line.match(/^(\s*)/)?.[1] ?? '      '
        const formattedAssertion = assertion
          .split('\n')
          .map((l) => indentation + l.trim())
          .join('\n')
        result.push(formattedAssertion)
        replacements++
      } else {
        // Keep original if no mapping found
        result.push(line)
      }
    } else {
      result.push(line)
    }
  }

  if (replacements > 0 && !dryRun) {
    await writeFile(filePath, result.join('\n'), 'utf-8')
  }

  return { path: filePath, improved: replacements > 0, replacements }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')

  console.log('🔍 Finding API spec files...')
  const files = await findSpecFiles(API_SPECS_DIR)
  console.log(`Found ${files.length} spec files\n`)

  if (dryRun) {
    console.log('🏃 Running in DRY RUN mode - no files will be modified\n')
  }

  let totalImproved = 0
  let totalReplacements = 0

  for (const file of files) {
    const result = await improveFile(file, dryRun)
    if (result.improved) {
      totalImproved++
      totalReplacements += result.replacements
      console.log(`✅ ${result.path}: ${result.replacements} replacements`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`Total files improved: ${totalImproved}`)
  console.log(`Total replacements: ${totalReplacements}`)

  if (dryRun && totalImproved > 0) {
    console.log('\nRun without --dry-run to apply changes')
  }
}

main().catch(console.error)
