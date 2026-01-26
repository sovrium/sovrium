/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import {
  ErrorClassifier,
  ErrorClassifierLive,
  ErrorType,
  ErrorCategory,
  classifyError,
  matchErrorPattern,
  containsSuccessMarker,
} from './error-classifier'

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Helper to run effects with the ErrorClassifier service
 */
const runWithService = <A, E>(effect: Effect.Effect<A, E, ErrorClassifier>) =>
  Effect.runPromise(Effect.provide(effect, ErrorClassifierLive))

// =============================================================================
// Pure Function Tests
// =============================================================================

describe('containsSuccessMarker', () => {
  it('should detect success marker in logs', () => {
    const logs = 'Some output {"type": "result", "subtype": "success", "data": {}}'
    expect(containsSuccessMarker(logs)).toBe(true)
  })

  it('should handle various whitespace in success marker', () => {
    expect(containsSuccessMarker('"subtype":"success"')).toBe(true)
    expect(containsSuccessMarker('"subtype" : "success"')).toBe(true)
    expect(containsSuccessMarker('"subtype":  "success"')).toBe(true)
  })

  it('should return false when no success marker', () => {
    expect(containsSuccessMarker('Some error output')).toBe(false)
    expect(containsSuccessMarker('"subtype": "error"')).toBe(false)
    expect(containsSuccessMarker('')).toBe(false)
  })
})

describe('matchErrorPattern', () => {
  describe('Rate limit patterns', () => {
    it('should match Anthropic rate limit (429)', () => {
      const pattern = matchErrorPattern('Error: rate_limit_error - you hit a rate limit')
      expect(pattern?.type).toBe(ErrorType.RATE_LIMIT_EXCEEDED)
    })

    it('should match 429 error code', () => {
      const pattern = matchErrorPattern('Error: 429 Too Many Requests')
      expect(pattern?.type).toBe(ErrorType.RATE_LIMIT_EXCEEDED)
    })

    it('should match API overloaded (529)', () => {
      const pattern = matchErrorPattern('overloaded_error: API is temporarily overloaded')
      expect(pattern?.type).toBe(ErrorType.API_OVERLOADED)
    })

    it('should match 529 error code', () => {
      const pattern = matchErrorPattern('Error 529: Server overloaded')
      expect(pattern?.type).toBe(ErrorType.API_OVERLOADED)
    })

    it('should match credit exhaustion patterns', () => {
      expect(matchErrorPattern('Claude usage limit reached')?.type).toBe(ErrorType.CREDIT_EXHAUSTED)
      expect(matchErrorPattern('Your quota exceeded')?.type).toBe(ErrorType.CREDIT_EXHAUSTED)
      expect(matchErrorPattern('limit will reset in 5 hours')?.type).toBe(
        ErrorType.CREDIT_EXHAUSTED
      )
      expect(matchErrorPattern('insufficient credit')?.type).toBe(ErrorType.CREDIT_EXHAUSTED)
    })
  })

  describe('Authentication patterns', () => {
    it('should match authentication errors', () => {
      expect(matchErrorPattern('authentication_error: invalid token')?.type).toBe(
        ErrorType.AUTH_ERROR
      )
      expect(matchErrorPattern('Error: unauthorized')?.type).toBe(ErrorType.AUTH_ERROR)
      expect(matchErrorPattern('token expired')?.type).toBe(ErrorType.AUTH_ERROR)
      expect(matchErrorPattern('issue with your API key')?.type).toBe(ErrorType.AUTH_ERROR)
    })
  })

  describe('Infrastructure patterns', () => {
    it('should match permission errors', () => {
      const pattern = matchErrorPattern('EPERM: Operation not permitted')
      expect(pattern?.type).toBe(ErrorType.PERMISSION_ERROR)
      expect(pattern?.isInfrastructure).toBe(true)
    })

    it('should match timeout errors', () => {
      expect(matchErrorPattern('ETIMEDOUT: connection timed out')?.type).toBe(ErrorType.TIMEOUT)
      expect(matchErrorPattern('Operation timed out')?.type).toBe(ErrorType.TIMEOUT)
    })

    it('should match network errors', () => {
      expect(matchErrorPattern('ECONNRESET: connection reset')?.type).toBe(ErrorType.NETWORK_ERROR)
      expect(matchErrorPattern('ENOTFOUND: dns lookup failed')?.type).toBe(ErrorType.NETWORK_ERROR)
      expect(matchErrorPattern('socket hang up')?.type).toBe(ErrorType.NETWORK_ERROR)
    })

    it('should match resource exhaustion', () => {
      expect(matchErrorPattern('out of memory')?.type).toBe(ErrorType.RESOURCE_EXHAUSTION)
      expect(matchErrorPattern('process killed by OOM killer')?.type).toBe(
        ErrorType.RESOURCE_EXHAUSTION
      )
    })

    it('should match disk full errors', () => {
      expect(matchErrorPattern('ENOSPC: no space left on device')?.type).toBe(ErrorType.DISK_FULL)
      expect(matchErrorPattern('no space left')?.type).toBe(ErrorType.DISK_FULL)
    })

    it('should match workflow cancellation', () => {
      expect(matchErrorPattern('Workflow cancelled by user')?.type).toBe(
        ErrorType.WORKFLOW_CANCELLED
      )
      expect(matchErrorPattern('Job was canceled')?.type).toBe(ErrorType.WORKFLOW_CANCELLED)
    })

    it('should match GitHub rate limits', () => {
      const pattern = matchErrorPattern('API rate limit exceeded for installation')
      expect(pattern?.type).toBe(ErrorType.GITHUB_RATE_LIMIT)
      expect(pattern?.isInfrastructure).toBe(true) // GitHub limits are quickly retriable
    })
  })

  describe('Code error patterns', () => {
    it('should match lint errors', () => {
      expect(matchErrorPattern('ESLint error in file.ts')?.type).toBe(ErrorType.LINT_ERROR)
      expect(matchErrorPattern('functional/immutable-data violation')?.type).toBe(
        ErrorType.LINT_ERROR
      )
    })

    it('should match test failures', () => {
      expect(matchErrorPattern('Test failed: expected 1 to equal 2')?.type).toBe(
        ErrorType.TEST_FAILURE
      )
      expect(matchErrorPattern('FAIL src/test.ts')?.type).toBe(ErrorType.TEST_FAILURE)
      expect(matchErrorPattern('AssertionError: expected true to be false')?.type).toBe(
        ErrorType.TEST_FAILURE
      )
    })

    it('should match code errors', () => {
      expect(matchErrorPattern('SyntaxError: Unexpected token')?.type).toBe(ErrorType.CODE_ERROR)
      expect(matchErrorPattern("TypeError: Cannot read property 'x' of undefined")?.type).toBe(
        ErrorType.CODE_ERROR
      )
      expect(matchErrorPattern('ReferenceError: foo is not defined')?.type).toBe(
        ErrorType.CODE_ERROR
      )
    })
  })

  describe('No match', () => {
    it('should return null for unknown patterns', () => {
      expect(matchErrorPattern('Some random log message')).toBeNull()
      expect(matchErrorPattern('')).toBeNull()
    })
  })
})

describe('classifyError', () => {
  describe('Success outcomes', () => {
    it('should classify success outcome', () => {
      const result = classifyError('', 'success', true)
      expect(result.errorType).toBe(ErrorType.SUCCESS)
      expect(result.category).toBe(ErrorCategory.SUCCESS)
      expect(result.isRetryable).toBe(false)
      expect(result.shouldPauseQueue).toBe(false)
    })
  })

  describe('Cancelled outcomes', () => {
    it('should classify cancelled as timeout', () => {
      const result = classifyError('', 'cancelled', false)
      expect(result.errorType).toBe(ErrorType.CANCELLED_TIMEOUT)
      expect(result.category).toBe(ErrorCategory.INFRASTRUCTURE)
      expect(result.isRetryable).toBe(true)
    })
  })

  describe('SDK crash detection', () => {
    it('should detect SDK crash after success', () => {
      const logs = '{"type": "result", "subtype": "success", "data": {}}'
      const result = classifyError(logs, 'failure', false) // No branch created
      expect(result.errorType).toBe(ErrorType.SDK_CRASH_AFTER_SUCCESS)
      expect(result.category).toBe(ErrorCategory.SPECIAL)
      expect(result.sdkCrashAfterSuccess).toBe(true)
      expect(result.isRetryable).toBe(false) // Don't retry - work is done
    })

    it('should not flag SDK crash when branch exists', () => {
      const logs = '{"type": "result", "subtype": "success", "data": {}}'
      const result = classifyError(logs, 'failure', true) // Branch exists
      expect(result.errorType).toBe(ErrorType.POST_PROCESSING_404)
      expect(result.sdkCrashAfterSuccess).toBe(false)
    })
  })

  describe('Post-processing 404', () => {
    it('should detect post-processing 404 false negative', () => {
      const result = classifyError('Some error', 'failure', true) // Branch exists despite failure
      expect(result.errorType).toBe(ErrorType.POST_PROCESSING_404)
      expect(result.category).toBe(ErrorCategory.SPECIAL)
      expect(result.isRetryable).toBe(false)
    })
  })

  describe('Rate limit classification', () => {
    it('should classify rate limit and flag queue pause', () => {
      const result = classifyError('Error: rate_limit_error', 'failure', false)
      expect(result.errorType).toBe(ErrorType.RATE_LIMIT_EXCEEDED)
      expect(result.category).toBe(ErrorCategory.RATE_LIMIT)
      expect(result.shouldPauseQueue).toBe(true)
      expect(result.isRetryable).toBe(true) // After cooldown
    })

    it('should classify credit exhaustion and flag queue pause', () => {
      const result = classifyError('Claude usage limit reached', 'failure', false)
      expect(result.errorType).toBe(ErrorType.CREDIT_EXHAUSTED)
      expect(result.shouldPauseQueue).toBe(true)
    })
  })

  describe('Default classification', () => {
    it('should default to claude_failure for unknown errors', () => {
      const result = classifyError('Some unknown error', 'failure', false)
      expect(result.errorType).toBe(ErrorType.CLAUDE_FAILURE)
      expect(result.category).toBe(ErrorCategory.UNKNOWN)
      expect(result.isInfrastructure).toBe(true) // Conservative: allow retry
      expect(result.isRetryable).toBe(true)
    })
  })
})

// =============================================================================
// Effect Service Tests
// =============================================================================

describe('ErrorClassifier Service', () => {
  describe('classify', () => {
    it('should classify errors through service', async () => {
      const result = await runWithService(
        Effect.gen(function* () {
          const classifier = yield* ErrorClassifier
          return yield* classifier.classify('Error: rate_limit_error', 'failure', false)
        })
      )

      expect(result.errorType).toBe(ErrorType.RATE_LIMIT_EXCEEDED)
      expect(result.shouldPauseQueue).toBe(true)
    })

    it('should classify success outcome', async () => {
      const result = await runWithService(
        Effect.gen(function* () {
          const classifier = yield* ErrorClassifier
          return yield* classifier.classify('', 'success', true)
        })
      )

      expect(result.errorType).toBe(ErrorType.SUCCESS)
    })
  })

  describe('shouldPauseQueue', () => {
    it('should return true for rate limit errors', async () => {
      const shouldPause = await runWithService(
        Effect.gen(function* () {
          const classifier = yield* ErrorClassifier
          return yield* classifier.shouldPauseQueue(ErrorType.RATE_LIMIT_EXCEEDED)
        })
      )

      expect(shouldPause).toBe(true)
    })

    it('should return true for credit exhaustion', async () => {
      const shouldPause = await runWithService(
        Effect.gen(function* () {
          const classifier = yield* ErrorClassifier
          return yield* classifier.shouldPauseQueue(ErrorType.CREDIT_EXHAUSTED)
        })
      )

      expect(shouldPause).toBe(true)
    })

    it('should return false for infrastructure errors', async () => {
      const shouldPause = await runWithService(
        Effect.gen(function* () {
          const classifier = yield* ErrorClassifier
          return yield* classifier.shouldPauseQueue(ErrorType.NETWORK_ERROR)
        })
      )

      expect(shouldPause).toBe(false)
    })
  })

  describe('getRetryCategory', () => {
    it('should return spec for code errors', async () => {
      const category = await runWithService(
        Effect.gen(function* () {
          const classifier = yield* ErrorClassifier
          return yield* classifier.getRetryCategory(ErrorType.LINT_ERROR)
        })
      )

      expect(category).toBe('spec')
    })

    it('should return infra for infrastructure errors', async () => {
      const category = await runWithService(
        Effect.gen(function* () {
          const classifier = yield* ErrorClassifier
          return yield* classifier.getRetryCategory(ErrorType.NETWORK_ERROR)
        })
      )

      expect(category).toBe('infra')
    })
  })

  describe('detectSdkCrash', () => {
    it('should detect SDK crash scenario', async () => {
      const logs = '{"type": "result", "subtype": "success"}'

      const isSdkCrash = await runWithService(
        Effect.gen(function* () {
          const classifier = yield* ErrorClassifier
          return yield* classifier.detectSdkCrash(logs, 'failure', false)
        })
      )

      expect(isSdkCrash).toBe(true)
    })

    it('should not detect SDK crash when branch exists', async () => {
      const logs = '{"type": "result", "subtype": "success"}'

      const isSdkCrash = await runWithService(
        Effect.gen(function* () {
          const classifier = yield* ErrorClassifier
          return yield* classifier.detectSdkCrash(logs, 'failure', true) // Branch exists
        })
      )

      expect(isSdkCrash).toBe(false)
    })

    it('should not detect SDK crash when outcome is success', async () => {
      const logs = '{"type": "result", "subtype": "success"}'

      const isSdkCrash = await runWithService(
        Effect.gen(function* () {
          const classifier = yield* ErrorClassifier
          return yield* classifier.detectSdkCrash(logs, 'success', false)
        })
      )

      expect(isSdkCrash).toBe(false)
    })
  })
})

// =============================================================================
// Integration Tests (Real-world scenarios from tdd-execute.yml)
// =============================================================================

describe('Error Classification Integration', () => {
  it('should handle real Anthropic rate limit error', async () => {
    const logs = `
      Executing Claude Code...
      Error: rate_limit_error - Your account has hit a rate limit.
      Please wait before making additional requests.
      Status: 429
    `

    const result = await runWithService(
      Effect.gen(function* () {
        const classifier = yield* ErrorClassifier
        return yield* classifier.classify(logs, 'failure', false)
      })
    )

    expect(result.errorType).toBe(ErrorType.RATE_LIMIT_EXCEEDED)
    expect(result.shouldPauseQueue).toBe(true)
    expect(result.isRetryable).toBe(true)
  })

  it('should handle real credit exhaustion error', async () => {
    const logs = `
      Starting Claude Code execution...
      Error: Claude usage limit reached. Your limit will reset in 5 hours.
      Please upgrade your plan or wait for the limit to reset.
    `

    const result = await runWithService(
      Effect.gen(function* () {
        const classifier = yield* ErrorClassifier
        return yield* classifier.classify(logs, 'failure', false)
      })
    )

    expect(result.errorType).toBe(ErrorType.CREDIT_EXHAUSTED)
    expect(result.shouldPauseQueue).toBe(true)
  })

  it('should handle real SDK crash after success', async () => {
    const logs = `
      Claude Code executing...
      {"type":"result","subtype":"success","cost_usd":0.05}
      Error: Unexpected error during post-processing
      Failed to push changes to remote
    `

    const result = await runWithService(
      Effect.gen(function* () {
        const classifier = yield* ErrorClassifier
        return yield* classifier.classify(logs, 'failure', false)
      })
    )

    expect(result.errorType).toBe(ErrorType.SDK_CRASH_AFTER_SUCCESS)
    expect(result.sdkCrashAfterSuccess).toBe(true)
    expect(result.isRetryable).toBe(false) // Don't retry - would waste budget
  })

  it('should handle ESLint errors with fix instructions', async () => {
    const logs = `
      Running quality checks...
      ESLint error in src/domain/models/user.ts:15:10
      functional/immutable-data: Cannot use 'push' on arrays
    `

    const result = await runWithService(
      Effect.gen(function* () {
        const classifier = yield* ErrorClassifier
        const classification = yield* classifier.classify(logs, 'failure', false)
        const retryCategory = yield* classifier.getRetryCategory(classification.errorType)
        return { classification, retryCategory }
      })
    )

    expect(result.classification.errorType).toBe(ErrorType.LINT_ERROR)
    expect(result.classification.category).toBe(ErrorCategory.CODE)
    expect(result.retryCategory).toBe('spec')
  })

  it('should handle network errors during execution', async () => {
    const logs = `
      Connecting to Anthropic API...
      Error: ECONNRESET connection reset by peer
      Retrying...
      Error: socket hang up
    `

    const result = await runWithService(
      Effect.gen(function* () {
        const classifier = yield* ErrorClassifier
        return yield* classifier.classify(logs, 'failure', false)
      })
    )

    expect(result.errorType).toBe(ErrorType.NETWORK_ERROR)
    expect(result.isInfrastructure).toBe(true)
    expect(result.isRetryable).toBe(true)
  })
})
