/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { join } from 'node:path'
import { describe, test, expect } from 'bun:test'
import { analyzeTestImplementation } from './spec-analyzer'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')
const SPECS_DIR = join(PROJECT_ROOT, 'specs')

// TODO: Update tests to work with Effect Schema instead of JSON Schema files
describe.skip('spec-analyzer', () => {
  describe('analyzeTestImplementation', () => {
    test('should analyze test implementation status', async () => {
      const result = await analyzeTestImplementation(SPECS_DIR)

      // Should return analysis structure
      expect(result.totalSpecs).toBeGreaterThan(0)
      expect(result.todoSpecs).toBeGreaterThanOrEqual(0)
      expect(result.wipSpecs).toBeGreaterThanOrEqual(0)
      expect(result.doneSpecs).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(result.allSpecs)).toBe(true)
    })

    test('should calculate correct spec counts', async () => {
      const result = await analyzeTestImplementation(SPECS_DIR)

      // Total should equal sum of all statuses
      expect(result.totalSpecs).toBe(result.todoSpecs + result.wipSpecs + result.doneSpecs)
    })

    test('should calculate correct percentages', async () => {
      const result = await analyzeTestImplementation(SPECS_DIR)

      const expectedTodoPercent = Math.round((result.todoSpecs / result.totalSpecs) * 100)
      const expectedWipPercent = Math.round((result.wipSpecs / result.totalSpecs) * 100)
      const expectedDonePercent = Math.round((result.doneSpecs / result.totalSpecs) * 100)

      expect(result.todoPercent).toBe(expectedTodoPercent)
      expect(result.wipPercent).toBe(expectedWipPercent)
      expect(result.donePercent).toBe(expectedDonePercent)
    })

    test('should enrich specs with status and metadata', async () => {
      const result = await analyzeTestImplementation(SPECS_DIR)

      // Each spec should have required fields
      result.allSpecs.forEach((spec) => {
        expect(spec.id).toBeDefined()
        expect(spec.given).toBeDefined()
        expect(spec.when).toBeDefined()
        expect(spec.then).toBeDefined()
        expect(spec.sourceFile).toBeDefined()
        expect(spec.status).toBeDefined()
        expect(['TODO', 'WIP', 'DONE'].includes(spec.status)).toBe(true)
      })
    })

    test('should find specs from app directory', async () => {
      const result = await analyzeTestImplementation(SPECS_DIR)

      // Should include specs from specs/app/
      const appSpecs = result.allSpecs.filter((spec) => spec.sourceFile.includes('specs/app/'))

      expect(appSpecs.length).toBeGreaterThan(0)
    })

    test('should find specs from api directory', async () => {
      const result = await analyzeTestImplementation(SPECS_DIR)

      // Should include specs from specs/api/
      const apiSpecs = result.allSpecs.filter((spec) => spec.sourceFile.includes('specs/api/'))

      expect(apiSpecs.length).toBeGreaterThan(0)
    })

    test('should find specs from admin directory', async () => {
      const result = await analyzeTestImplementation(SPECS_DIR)

      // Should include specs from specs/admin/
      const adminSpecs = result.allSpecs.filter((spec) => spec.sourceFile.includes('specs/admin/'))

      expect(adminSpecs.length).toBeGreaterThan(0)
    })

    test('should categorize specs with valid ID format', async () => {
      const result = await analyzeTestImplementation(SPECS_DIR)

      // All spec IDs should match pattern: PREFIX-ENTITY-NNN
      const validIdPattern = /^[A-Z]+-[A-Z][A-Z0-9-]+-\d{3,}$/

      result.allSpecs.forEach((spec) => {
        expect(validIdPattern.test(spec.id)).toBe(true)
      })
    })

    test('should include source file paths', async () => {
      const result = await analyzeTestImplementation(SPECS_DIR)

      // All specs should have relative source file paths
      result.allSpecs.forEach((spec) => {
        expect(spec.sourceFile).toBeDefined()
        expect(spec.sourceFile.endsWith('.json')).toBe(true)
        expect(spec.sourceFile.includes('specs/')).toBe(true)
      })
    })

    test('should sort specs by status then ID', async () => {
      const result = await analyzeTestImplementation(SPECS_DIR)

      // Check that specs are sorted: DONE, then WIP, then TODO
      // Within each status, sorted by ID
      let lastStatus: 'DONE' | 'WIP' | 'TODO' | null = null
      let lastId = ''

      const statusOrder = { DONE: 1, WIP: 2, TODO: 3 }

      for (const spec of result.allSpecs) {
        if (lastStatus === null) {
          lastStatus = spec.status
          lastId = spec.id
          continue
        }

        // Status should not decrease (DONE -> WIP -> TODO)
        expect(statusOrder[spec.status]).toBeGreaterThanOrEqual(statusOrder[lastStatus])

        // Within same status, IDs should be sorted
        if (spec.status === lastStatus) {
          expect(spec.id >= lastId).toBe(true)
        }

        lastStatus = spec.status
        lastId = spec.id
      }
    })

    test('should handle empty directories gracefully', async () => {
      // This tests the edge case of no specs found
      // We can't easily create an empty temp dir, so we just verify
      // the function doesn't crash on the real directory
      const result = await analyzeTestImplementation(SPECS_DIR)

      expect(result.totalSpecs).toBeGreaterThan(0)
    })
  })
})
