/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Update PR Title Unit Tests
 *
 * Tests for the incrementAttempt Effect program that:
 * - Fetches PR via GitHubApi
 * - Parses and validates TDD title format
 * - Increments attempt counter
 * - Updates PR title
 */

import { describe, test, expect } from 'bun:test'
import { Effect, Layer } from 'effect'
import { GitHubApi } from '../services/github-api'
import { GitHubApiError } from './errors'
import { incrementAttempt } from './update-pr-title'

/**
 * Create a mock GitHubApi layer for testing
 */
function createMockGitHubApi(options: {
  prTitle: string
  prNumber?: number
  prBranch?: string
  updateResult?: 'success' | 'error'
}) {
  return Layer.succeed(GitHubApi, {
    listTDDPRs: () => Effect.succeed([]),
    getPR: (prNumber) =>
      Effect.succeed({
        number: options.prNumber ?? prNumber,
        title: options.prTitle,
        branch: options.prBranch ?? `tdd/api-test-001`,
        state: 'open' as const,
        labels: [],
      }),
    getWorkflowRuns: () => Effect.succeed([]),
    getRunLogs: () => Effect.succeed(''),
    createPR: () => Effect.succeed({ number: 1, url: 'https://github.com/test/pr/1' }),
    updatePRTitle: (_prNumber, _title) => {
      if (options.updateResult === 'error') {
        return Effect.fail(
          new GitHubApiError({ operation: 'updatePRTitle', cause: new Error('API error') })
        )
      }
      return Effect.void
    },
    addLabel: () => Effect.void,
    postComment: () => Effect.void,
    enableAutoMerge: () => Effect.void,
  })
}

describe('incrementAttempt', () => {
  test('increments attempt count for valid TDD PR title', async () => {
    const mockApi = createMockGitHubApi({
      prTitle: '[TDD] Implement API-TEST-001 | Attempt 1/5',
    })

    const program = incrementAttempt(123).pipe(Effect.provide(mockApi))
    const result = await Effect.runPromise(program)

    expect(result.specId).toBe('API-TEST-001')
    expect(result.newAttempt).toBe(2)
    expect(result.newTitle).toBe('[TDD] Implement API-TEST-001 | Attempt 2/5')
  })

  test('increments from attempt 4 to 5', async () => {
    const mockApi = createMockGitHubApi({
      prTitle: '[TDD] Implement API-TEST-001 | Attempt 4/5',
    })

    const program = incrementAttempt(456).pipe(Effect.provide(mockApi))
    const result = await Effect.runPromise(program)

    expect(result.newAttempt).toBe(5)
    expect(result.newTitle).toBe('[TDD] Implement API-TEST-001 | Attempt 5/5')
  })

  test('handles REGRESSION spec IDs', async () => {
    const mockApi = createMockGitHubApi({
      prTitle: '[TDD] Implement MIG-ERROR-REGRESSION | Attempt 1/5',
    })

    const program = incrementAttempt(789).pipe(Effect.provide(mockApi))
    const result = await Effect.runPromise(program)

    expect(result.specId).toBe('MIG-ERROR-REGRESSION')
    expect(result.newAttempt).toBe(2)
  })

  test('handles multi-segment spec IDs', async () => {
    const mockApi = createMockGitHubApi({
      prTitle: '[TDD] Implement API-TABLES-RECORDS-LIST-014 | Attempt 3/5',
    })

    const program = incrementAttempt(100).pipe(Effect.provide(mockApi))
    const result = await Effect.runPromise(program)

    expect(result.specId).toBe('API-TABLES-RECORDS-LIST-014')
    expect(result.newAttempt).toBe(4)
  })

  test('fails with InvalidPRTitleError for non-TDD title', async () => {
    const mockApi = createMockGitHubApi({
      prTitle: 'Fix authentication bug',
    })

    const program = incrementAttempt(123).pipe(Effect.provide(mockApi), Effect.either)
    const result = await Effect.runPromise(program)

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe('InvalidPRTitleError')
    }
  })

  test('fails with InvalidPRTitleError for partial TDD title', async () => {
    const mockApi = createMockGitHubApi({
      prTitle: '[TDD] Implement something',
    })

    const program = incrementAttempt(123).pipe(Effect.provide(mockApi), Effect.either)
    const result = await Effect.runPromise(program)

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe('InvalidPRTitleError')
    }
  })

  test('fails with GitHubApiError when update fails', async () => {
    const mockApi = createMockGitHubApi({
      prTitle: '[TDD] Implement API-TEST-001 | Attempt 1/5',
      updateResult: 'error',
    })

    const program = incrementAttempt(123).pipe(Effect.provide(mockApi), Effect.either)
    const result = await Effect.runPromise(program)

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe('GitHubApiError')
    }
  })

  test('preserves maxAttempts from original title', async () => {
    const mockApi = createMockGitHubApi({
      prTitle: '[TDD] Implement API-TEST-001 | Attempt 2/10',
    })

    const program = incrementAttempt(123).pipe(Effect.provide(mockApi))
    const result = await Effect.runPromise(program)

    // Title should preserve the original maxAttempts (10)
    expect(result.newTitle).toBe('[TDD] Implement API-TEST-001 | Attempt 3/10')
  })
})
