/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Increment Attempt Program Unit Tests
 *
 * Tests for the incrementAttempt Effect program that:
 * - Increments attempt counter in PR title
 * - Detects max attempts reached
 * - Adds manual-intervention label at max
 * - Posts explanatory comment at max
 */

import { describe, test, expect } from 'bun:test'
import { Effect, Layer } from 'effect'
import { GitHubApi } from '../services/github-api'
import { hasRemainingAttempts, incrementAttempt } from './increment-attempt'

/**
 * Track calls made to the mock GitHubApi
 */
interface MockCalls {
  updatePRTitle: Array<{ prNumber: number; title: string }>
  addLabel: Array<{ prNumber: number; label: string }>
  postComment: Array<{ prNumber: number; body: string }>
}

/**
 * Create a mock GitHubApi layer for testing
 */
function createMockGitHubApi(options: { prTitle: string; prNumber?: number }) {
  const calls: MockCalls = {
    updatePRTitle: [],
    addLabel: [],
    postComment: [],
  }

  const layer = Layer.succeed(GitHubApi, {
    listTDDPRs: () => Effect.succeed([]),
    getPR: (prNumber) =>
      Effect.succeed({
        number: options.prNumber ?? prNumber,
        title: options.prTitle,
        branch: `tdd/api-test-001`,
        state: 'open' as const,
        labels: [],
      }),
    getWorkflowRuns: () => Effect.succeed([]),
    getRunLogs: () => Effect.succeed(''),
    createPR: () => Effect.succeed({ number: 1, url: 'https://github.com/test/pr/1' }),
    updatePRTitle: (prNumber, title) => {
      calls.updatePRTitle.push({ prNumber, title })
      return Effect.succeed(undefined)
    },
    addLabel: (prNumber, label) => {
      calls.addLabel.push({ prNumber, label })
      return Effect.succeed(undefined)
    },
    postComment: (prNumber, body) => {
      calls.postComment.push({ prNumber, body })
      return Effect.succeed(undefined)
    },
    enableAutoMerge: () => Effect.succeed(undefined),
  })

  return { layer, calls }
}

describe('incrementAttempt', () => {
  test('increments attempt from 1 to 2', async () => {
    const { layer, calls } = createMockGitHubApi({
      prTitle: '[TDD] Implement API-TEST-001 | Attempt 1/5',
    })

    const program = incrementAttempt(123).pipe(Effect.provide(layer))
    const result = await Effect.runPromise(program)

    expect(result.prNumber).toBe(123)
    expect(result.previousAttempt).toBe(1)
    expect(result.newAttempt).toBe(2)
    expect(result.maxAttempts).toBe(5)
    expect(result.reachedMax).toBe(false)
    expect(result.newTitle).toBe('[TDD] Implement API-TEST-001 | Attempt 2/5')

    // Verify API call was made
    expect(calls.updatePRTitle).toHaveLength(1)
    expect(calls.updatePRTitle[0]?.title).toBe('[TDD] Implement API-TEST-001 | Attempt 2/5')
  })

  test('increments attempt from 4 to 5 (last attempt)', async () => {
    const { layer, calls } = createMockGitHubApi({
      prTitle: '[TDD] Implement API-TEST-001 | Attempt 4/5',
    })

    const program = incrementAttempt(456).pipe(Effect.provide(layer))
    const result = await Effect.runPromise(program)

    expect(result.previousAttempt).toBe(4)
    expect(result.newAttempt).toBe(5)
    expect(result.reachedMax).toBe(false)

    // Should update title, not add label
    expect(calls.updatePRTitle).toHaveLength(1)
    expect(calls.addLabel).toHaveLength(0)
    expect(calls.postComment).toHaveLength(0)
  })

  test('fails with MaxAttemptsReached when at max attempts', async () => {
    const { layer, calls } = createMockGitHubApi({
      prTitle: '[TDD] Implement API-TEST-001 | Attempt 5/5',
    })

    const program = incrementAttempt(789).pipe(Effect.provide(layer), Effect.either)
    const result = await Effect.runPromise(program)

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe('MaxAttemptsReached')
      if (result.left._tag === 'MaxAttemptsReached') {
        expect(result.left.prNumber).toBe(789)
        expect(result.left.specId).toBe('API-TEST-001')
        expect(result.left.attempts).toBe(5)
      }
    }

    // Should add label and post comment, but NOT update title
    expect(calls.updatePRTitle).toHaveLength(0)
    expect(calls.addLabel).toHaveLength(1)
    expect(calls.addLabel[0]?.label).toBe('tdd-automation:manual-intervention')
    expect(calls.postComment).toHaveLength(1)
    expect(calls.postComment[0]?.body).toContain('Manual Intervention Required')
  })

  test('comment includes spec ID and max attempts info', async () => {
    const { layer, calls } = createMockGitHubApi({
      prTitle: '[TDD] Implement MIG-ERROR-REGRESSION | Attempt 3/3',
    })

    const program = incrementAttempt(100).pipe(Effect.provide(layer), Effect.either)
    await Effect.runPromise(program)

    expect(calls.postComment).toHaveLength(1)
    const comment = calls.postComment[0]?.body ?? ''

    expect(comment).toContain('MIG-ERROR-REGRESSION')
    expect(comment).toContain('maximum of 3 automated attempts')
    expect(comment).toContain('What to do next')
  })

  test('fails with GitHubApiError for invalid PR title format', async () => {
    const { layer } = createMockGitHubApi({
      prTitle: 'Fix authentication bug',
    })

    const program = incrementAttempt(123).pipe(Effect.provide(layer), Effect.either)
    const result = await Effect.runPromise(program)

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe('GitHubApiError')
    }
  })

  test('handles multi-segment spec IDs', async () => {
    const { layer } = createMockGitHubApi({
      prTitle: '[TDD] Implement API-TABLES-RECORDS-LIST-014 | Attempt 2/5',
    })

    const program = incrementAttempt(200).pipe(Effect.provide(layer))
    const result = await Effect.runPromise(program)

    expect(result.newTitle).toBe('[TDD] Implement API-TABLES-RECORDS-LIST-014 | Attempt 3/5')
  })
})

describe('hasRemainingAttempts', () => {
  test('returns true when attempts remain', async () => {
    const { layer } = createMockGitHubApi({
      prTitle: '[TDD] Implement API-TEST-001 | Attempt 3/5',
    })

    const program = hasRemainingAttempts(123).pipe(Effect.provide(layer))
    const result = await Effect.runPromise(program)

    expect(result).toBe(true)
  })

  test('returns false when at max attempts', async () => {
    const { layer } = createMockGitHubApi({
      prTitle: '[TDD] Implement API-TEST-001 | Attempt 5/5',
    })

    const program = hasRemainingAttempts(123).pipe(Effect.provide(layer))
    const result = await Effect.runPromise(program)

    expect(result).toBe(false)
  })

  test('returns false for invalid PR title', async () => {
    const { layer } = createMockGitHubApi({
      prTitle: 'Not a TDD PR',
    })

    const program = hasRemainingAttempts(123).pipe(Effect.provide(layer))
    const result = await Effect.runPromise(program)

    expect(result).toBe(false)
  })
})
