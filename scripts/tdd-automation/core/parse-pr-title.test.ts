/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Parse PR Title Unit Tests
 *
 * Tests for TDD PR title parsing functions:
 * - parseTDDPRTitle: Extract spec ID and attempt from title
 * - isTDDPRTitle: Boolean check for valid TDD title format
 * - extractSpecIdFromBranch: Extract spec ID from branch name
 */

import { describe, test, expect } from 'bun:test'
import { extractSpecIdFromBranch, isTDDPRTitle, parseTDDPRTitle } from './parse-pr-title'

describe('parseTDDPRTitle', () => {
  test('parses valid TDD PR title with numeric spec ID', () => {
    const result = parseTDDPRTitle('[TDD] Implement APP-VERSION-001 | Attempt 2/5')

    expect(result).not.toBeNull()
    expect(result?.specId).toBe('APP-VERSION-001')
    expect(result?.attempt).toBe(2)
    expect(result?.maxAttempts).toBe(5)
  })

  test('parses valid TDD PR title with REGRESSION suffix', () => {
    const result = parseTDDPRTitle('[TDD] Implement MIG-ERROR-REGRESSION | Attempt 1/5')

    expect(result).not.toBeNull()
    expect(result?.specId).toBe('MIG-ERROR-REGRESSION')
    expect(result?.attempt).toBe(1)
    expect(result?.maxAttempts).toBe(5)
  })

  test('parses title with lowercase letters (case-insensitive)', () => {
    const result = parseTDDPRTitle('[tdd] implement api-health-002 | attempt 3/5')

    expect(result).not.toBeNull()
    expect(result?.specId).toBe('API-HEALTH-002')
    expect(result?.attempt).toBe(3)
    expect(result?.maxAttempts).toBe(5)
  })

  test('parses title with extra whitespace (regex uses \\s+)', () => {
    const result = parseTDDPRTitle('[TDD]  Implement  APP-VERSION-001  |  Attempt 1/5')

    // The regex uses \s+ which accepts multiple whitespace characters
    expect(result).not.toBeNull()
    expect(result?.specId).toBe('APP-VERSION-001')
    expect(result?.attempt).toBe(1)
    expect(result?.maxAttempts).toBe(5)
  })

  test('returns null for non-TDD title', () => {
    const result = parseTDDPRTitle('Fix bug in authentication')

    expect(result).toBeNull()
  })

  test('returns null for title missing [TDD] prefix', () => {
    const result = parseTDDPRTitle('Implement APP-VERSION-001 | Attempt 1/5')

    expect(result).toBeNull()
  })

  test('returns null for title missing attempt counter', () => {
    const result = parseTDDPRTitle('[TDD] Implement APP-VERSION-001')

    expect(result).toBeNull()
  })

  test('returns null for title with invalid spec ID format', () => {
    // Spec ID must be CATEGORY-NAME-NUMBER or CATEGORY-NAME-REGRESSION
    const result = parseTDDPRTitle('[TDD] Implement INVALID | Attempt 1/5')

    expect(result).toBeNull()
  })

  test('returns null for empty string', () => {
    const result = parseTDDPRTitle('')

    expect(result).toBeNull()
  })

  test('parses attempt at max attempts', () => {
    const result = parseTDDPRTitle('[TDD] Implement API-TABLES-005 | Attempt 5/5')

    expect(result).not.toBeNull()
    expect(result?.attempt).toBe(5)
    expect(result?.maxAttempts).toBe(5)
  })

  test('parses double-digit attempt numbers', () => {
    const result = parseTDDPRTitle('[TDD] Implement API-TABLES-010 | Attempt 10/15')

    expect(result).not.toBeNull()
    expect(result?.attempt).toBe(10)
    expect(result?.maxAttempts).toBe(15)
  })

  test('parses multi-segment spec ID', () => {
    const result = parseTDDPRTitle('[TDD] Implement API-TABLES-RECORDS-LIST-001 | Attempt 1/5')

    expect(result).not.toBeNull()
    expect(result?.specId).toBe('API-TABLES-RECORDS-LIST-001')
  })
})

describe('isTDDPRTitle', () => {
  test('returns true for valid TDD title', () => {
    expect(isTDDPRTitle('[TDD] Implement APP-VERSION-001 | Attempt 1/5')).toBe(true)
  })

  test('returns true for REGRESSION suffix', () => {
    expect(isTDDPRTitle('[TDD] Implement MIG-ERROR-REGRESSION | Attempt 1/5')).toBe(true)
  })

  test('returns false for non-TDD title', () => {
    expect(isTDDPRTitle('Fix authentication bug')).toBe(false)
  })

  test('returns false for partial match', () => {
    expect(isTDDPRTitle('[TDD] Implement something')).toBe(false)
  })

  test('returns false for empty string', () => {
    expect(isTDDPRTitle('')).toBe(false)
  })
})

describe('extractSpecIdFromBranch', () => {
  test('extracts spec ID from lowercase branch', () => {
    const result = extractSpecIdFromBranch('tdd/app-version-001')

    expect(result).toBe('APP-VERSION-001')
  })

  test('extracts spec ID from uppercase branch', () => {
    const result = extractSpecIdFromBranch('TDD/APP-VERSION-001')

    expect(result).toBe('APP-VERSION-001')
  })

  test('extracts spec ID with REGRESSION suffix', () => {
    const result = extractSpecIdFromBranch('tdd/mig-error-regression')

    expect(result).toBe('MIG-ERROR-REGRESSION')
  })

  test('extracts multi-segment spec ID', () => {
    const result = extractSpecIdFromBranch('tdd/api-tables-records-list-014')

    expect(result).toBe('API-TABLES-RECORDS-LIST-014')
  })

  test('returns null for non-TDD branch', () => {
    const result = extractSpecIdFromBranch('feature/new-feature')

    expect(result).toBeNull()
  })

  test('returns null for main branch', () => {
    const result = extractSpecIdFromBranch('main')

    expect(result).toBeNull()
  })

  test('returns null for empty string', () => {
    const result = extractSpecIdFromBranch('')

    expect(result).toBeNull()
  })

  test('returns null for branch without slash', () => {
    const result = extractSpecIdFromBranch('tddapp-version-001')

    expect(result).toBeNull()
  })
})
