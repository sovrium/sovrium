#!/usr/bin/env bun
/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Script to generate E2E test files for API specifications
 * Reads JSON spec files and creates corresponding .spec.ts files
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'

interface XSpec {
  id: string
  given: string
  when: string
  then: string
}

interface APISpec {
  summary: string
  'x-specs': XSpec[]
}

function generateTestFile(jsonPath: string, outputPath: string): void {
  // Read the JSON file
  const content = readFileSync(jsonPath, 'utf-8')
  const spec: APISpec = JSON.parse(content)

  const specs = spec['x-specs'] || []
  const summary = spec.summary || 'API endpoint'

  // Generate test content
  const testContent = `import { test, expect } from '@/specs/fixtures.ts'

/**
 * E2E Tests for ${summary}
 *
 * Source: ${jsonPath.replace('/Users/thomasjeanneau/Codes/sovrium/', '')}
 * Domain: api
 * Spec Count: ${specs.length}
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (${specs.length} tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('${summary}', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

${specs
  .map((s) => {
    const testTitle = extractTestTitle(s.then)
    return `  test.fixme(
    '${s.id}: ${testTitle}',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: ${s.given}
      // TODO: Setup test data

      // WHEN: ${s.when}
      // TODO: Make API request

      // THEN: ${s.then}
      // TODO: Add assertions
    }
  )`
  })
  .join('\n\n')}

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'user can complete full ${summary.toLowerCase()} workflow',
    { tag: '@regression' },
    async ({ request }) => {
      // GIVEN: Application with representative configuration
      // TODO: Setup test data

      // WHEN/THEN: Streamlined workflow testing integration points
      // TODO: Add optimized integration tests
    }
  )
})
`

  // Write the test file
  writeFileSync(outputPath, testContent)
  console.log(`✅ Generated: ${outputPath}`)
}

function extractTestTitle(then: string): string {
  // Extract a concise test title from the "then" clause
  // Remove "Response should be" / "Should" prefixes
  let title = then
    .replace(/^Response should be /i, '')
    .replace(/^Should /i, '')
    .replace(/^should /i, '')

  // Ensure it starts with lowercase (after "should")
  if (title.length > 0) {
    title = 'should ' + title.charAt(0).toLowerCase() + title.slice(1)
  }

  return title
}

// Generate test files for remaining records endpoints
const files = [
  {
    json: 'specs/api/paths/tables/{tableId}/records/get.json',
    test: 'specs/api/paths/tables/{tableId}/records/get.spec.ts',
  },
  {
    json: 'specs/api/paths/tables/{tableId}/records/post.json',
    test: 'specs/api/paths/tables/{tableId}/records/post.spec.ts',
  },
  {
    json: 'specs/api/paths/tables/{tableId}/records/{recordId}/get.json',
    test: 'specs/api/paths/tables/{tableId}/records/{recordId}/get.spec.ts',
  },
  {
    json: 'specs/api/paths/tables/{tableId}/records/{recordId}/patch.json',
    test: 'specs/api/paths/tables/{tableId}/records/{recordId}/patch.spec.ts',
  },
  {
    json: 'specs/api/paths/tables/{tableId}/records/{recordId}/delete.json',
    test: 'specs/api/paths/tables/{tableId}/records/{recordId}/delete.spec.ts',
  },
  {
    json: 'specs/api/paths/tables/{tableId}/records/batch/post.json',
    test: 'specs/api/paths/tables/{tableId}/records/batch/post.spec.ts',
  },
  {
    json: 'specs/api/paths/tables/{tableId}/records/batch/patch.json',
    test: 'specs/api/paths/tables/{tableId}/records/batch/patch.spec.ts',
  },
  {
    json: 'specs/api/paths/tables/{tableId}/records/batch/delete.json',
    test: 'specs/api/paths/tables/{tableId}/records/batch/delete.spec.ts',
  },
  {
    json: 'specs/api/paths/tables/{tableId}/records/upsert/post.json',
    test: 'specs/api/paths/tables/{tableId}/records/upsert/post.spec.ts',
  },
]

console.log('🔧 Generating API test files...\n')

for (const { json, test } of files) {
  try {
    generateTestFile(json, test)
  } catch (error) {
    console.error(`❌ Failed to generate ${test}:`, error)
  }
}

console.log('\n✨ Done! Generated all remaining test files.')
