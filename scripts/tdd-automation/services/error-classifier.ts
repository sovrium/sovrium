/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Context, Layer } from 'effect'

// =============================================================================
// Error Types Enum
// =============================================================================

/**
 * All possible error types detected in TDD workflow execution.
 * Extracted from .github/workflows/tdd-execute.yml error classification logic.
 */
export const ErrorType = {
  // Infrastructure errors (retriable at workflow level)
  PERMISSION_ERROR: 'permission_error',
  TIMEOUT: 'timeout',
  NETWORK_ERROR: 'network_error',
  RESOURCE_EXHAUSTION: 'resource_exhaustion',
  DISK_FULL: 'disk_full',
  WORKFLOW_CANCELLED: 'workflow_cancelled',
  GITHUB_RATE_LIMIT: 'github_rate_limit',

  // Code errors (retriable with fix instructions)
  LINT_ERROR: 'lint_error',
  TEST_FAILURE: 'test_failure',
  CODE_ERROR: 'code_error',

  // Credit/rate limit exhaustion (requires cooldown, NOT immediately retriable)
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  API_OVERLOADED: 'api_overloaded',
  CREDIT_EXHAUSTED: 'credit_exhausted',

  // Authentication errors (NOT retriable, requires manual fix)
  AUTH_ERROR: 'auth_error',

  // Special cases
  SDK_CRASH_AFTER_SUCCESS: 'sdk_crash_after_success',
  POST_PROCESSING_404: 'post_processing_404_false_negative',
  TIMEOUT_CONFIRMED: 'timeout_confirmed',
  CANCELLED_TIMEOUT: 'cancelled_timeout',
  CLAUDE_FAILURE: 'claude_failure',
  UNKNOWN_OUTCOME: 'unknown_outcome',
  SUCCESS: 'success',
  UNKNOWN: 'unknown',
} as const

export type ErrorType = (typeof ErrorType)[keyof typeof ErrorType]

// =============================================================================
// Error Category
// =============================================================================

/**
 * High-level error categories for retry logic.
 */
export const ErrorCategory = {
  /** Retriable infrastructure issues (network, timeout, etc.) */
  INFRASTRUCTURE: 'infrastructure',
  /** Code issues that Claude can fix with guidance */
  CODE: 'code',
  /** Credit/rate limit - requires cooldown before retry */
  RATE_LIMIT: 'rate_limit',
  /** Auth issues - requires manual intervention */
  AUTH: 'auth',
  /** Special cases requiring specific handling */
  SPECIAL: 'special',
  /** Successful execution */
  SUCCESS: 'success',
  /** Unknown/unclassified errors */
  UNKNOWN: 'unknown',
} as const

export type ErrorCategory = (typeof ErrorCategory)[keyof typeof ErrorCategory]

// =============================================================================
// Classification Result
// =============================================================================

/**
 * Result of error classification.
 */
export interface ClassificationResult {
  /** Specific error type detected */
  readonly errorType: ErrorType

  /** High-level error category */
  readonly category: ErrorCategory

  /** Whether this is an infrastructure error (for workflow retry logic) */
  readonly isInfrastructure: boolean

  /** Whether this error type is retriable (with or without cooldown) */
  readonly isRetryable: boolean

  /** Whether the queue should pause (credit/rate limit exhaustion) */
  readonly shouldPauseQueue: boolean

  /** Whether Claude's work succeeded despite action failure (SDK crash scenario) */
  readonly sdkCrashAfterSuccess: boolean

  /** Human-readable description of the error */
  readonly message: string
}

/**
 * Alias for ClassificationResult (for backward compatibility with retry-manager)
 */
export type ErrorClassification = ClassificationResult

// =============================================================================
// Error Patterns (Extracted from tdd-execute.yml)
// =============================================================================

interface ErrorPattern {
  readonly type: ErrorType
  readonly category: ErrorCategory
  readonly patterns: readonly RegExp[]
  readonly isInfrastructure: boolean
  readonly isRetryable: boolean
  readonly shouldPauseQueue: boolean
  readonly message: string
}

/**
 * Error detection patterns in priority order.
 * Higher priority patterns are checked first.
 */
const ERROR_PATTERNS: readonly ErrorPattern[] = [
  // =========================================================================
  // Credit/Rate Limit Exhaustion (highest priority - requires queue pause)
  // =========================================================================
  {
    type: ErrorType.RATE_LIMIT_EXCEEDED,
    category: ErrorCategory.RATE_LIMIT,
    patterns: [
      /rate_limit_error/i,
      /hit a rate limit/i,
      /would exceed your.*(rate|account).?limit/i,
      /Error: 429/i,
      /"type".*429/i,
    ],
    isInfrastructure: false,
    isRetryable: true, // After cooldown
    shouldPauseQueue: true,
    message: 'Anthropic API rate limit (429) - Queue should PAUSE',
  },
  {
    type: ErrorType.API_OVERLOADED,
    category: ErrorCategory.RATE_LIMIT,
    patterns: [/overloaded_error/i, /529/, /temporarily overloaded/i, /API is.*overloaded/i],
    isInfrastructure: false,
    isRetryable: true, // After cooldown
    shouldPauseQueue: true,
    message: 'Anthropic API overloaded (529) - Queue should PAUSE',
  },
  {
    type: ErrorType.CREDIT_EXHAUSTED,
    category: ErrorCategory.RATE_LIMIT,
    patterns: [
      /Claude.*(usage|AI).?limit.?reached/i,
      /usage.?limit/i,
      /limit.?will.?reset/i,
      /5.?hour.?limit/i,
      /insufficient.?credit/i,
      /credit.?limit/i,
      /quota.?exceeded/i,
      /billing.?error/i,
      /account.?suspended/i,
    ],
    isInfrastructure: false,
    isRetryable: true, // After cooldown
    shouldPauseQueue: true,
    message: 'Claude Code usage limit reached - Queue should PAUSE',
  },

  // =========================================================================
  // Authentication Errors (requires manual intervention)
  // =========================================================================
  {
    type: ErrorType.AUTH_ERROR,
    category: ErrorCategory.AUTH,
    patterns: [
      /authentication_error/i,
      /permission_error/i,
      /issue with your API key/i,
      /does not have permission/i,
      /unauthorized/i,
      /token.?expired/i,
      /oauth.?error/i,
    ],
    isInfrastructure: false,
    isRetryable: false,
    shouldPauseQueue: false,
    message: 'Authentication/permission error - Manual intervention required',
  },

  // =========================================================================
  // GitHub Rate Limits (retriable after short wait)
  // =========================================================================
  {
    type: ErrorType.GITHUB_RATE_LIMIT,
    category: ErrorCategory.INFRASTRUCTURE,
    patterns: [
      /API rate limit exceeded for installation/i,
      /secondary rate limit/i,
      /abuse detection/i,
    ],
    isInfrastructure: true,
    isRetryable: true,
    shouldPauseQueue: false,
    message: 'GitHub API rate limit - Will retry',
  },

  // =========================================================================
  // Infrastructure Errors (retriable at workflow level)
  // =========================================================================
  {
    type: ErrorType.PERMISSION_ERROR,
    category: ErrorCategory.INFRASTRUCTURE,
    patterns: [/EPERM: Operation not permitted/i],
    isInfrastructure: true,
    isRetryable: true,
    shouldPauseQueue: false,
    message: 'Permission error (EPERM) - Will retry',
  },
  {
    type: ErrorType.TIMEOUT,
    category: ErrorCategory.INFRASTRUCTURE,
    patterns: [/ETIMEDOUT/i, /timeout/i, /timed out/i],
    isInfrastructure: true,
    isRetryable: true,
    shouldPauseQueue: false,
    message: 'Timeout error - Will retry',
  },
  {
    type: ErrorType.NETWORK_ERROR,
    category: ErrorCategory.INFRASTRUCTURE,
    patterns: [/ECONNRESET/i, /ENOTFOUND/i, /socket hang up/i],
    isInfrastructure: true,
    isRetryable: true,
    shouldPauseQueue: false,
    message: 'Network error - Will retry',
  },
  {
    type: ErrorType.RESOURCE_EXHAUSTION,
    category: ErrorCategory.INFRASTRUCTURE,
    patterns: [/out of memory/i, /OOM/i, /killed/],
    isInfrastructure: true,
    isRetryable: true,
    shouldPauseQueue: false,
    message: 'Resource exhaustion (OOM) - Will retry',
  },
  {
    type: ErrorType.DISK_FULL,
    category: ErrorCategory.INFRASTRUCTURE,
    patterns: [/ENOSPC/i, /no space left/i],
    isInfrastructure: true,
    isRetryable: true,
    shouldPauseQueue: false,
    message: 'Disk space error - Will retry',
  },
  {
    type: ErrorType.WORKFLOW_CANCELLED,
    category: ErrorCategory.INFRASTRUCTURE,
    patterns: [/cancelled/i, /canceled/i],
    isInfrastructure: true,
    isRetryable: true,
    shouldPauseQueue: false,
    message: 'Workflow cancellation - Will retry',
  },

  // =========================================================================
  // Code Errors (retriable with fix instructions)
  // =========================================================================
  {
    type: ErrorType.LINT_ERROR,
    category: ErrorCategory.CODE,
    patterns: [
      /lint.*error/i,
      /ESLint.*error/i,
      /functional\/immutable-data/i,
      /no-restricted-syntax/i,
    ],
    isInfrastructure: true, // Treated as retriable in workflow
    isRetryable: true,
    shouldPauseQueue: false,
    message: 'Lint error - Will retry with fix instructions',
  },
  {
    type: ErrorType.TEST_FAILURE,
    category: ErrorCategory.CODE,
    patterns: [/Test.*failed/i, /FAIL\s/i, /AssertionError/i],
    isInfrastructure: true, // Treated as retriable in workflow
    isRetryable: true,
    shouldPauseQueue: false,
    message: 'Test failure - Will retry with fix instructions',
  },
  {
    type: ErrorType.CODE_ERROR,
    category: ErrorCategory.CODE,
    patterns: [/SyntaxError/i, /TypeError/i, /ReferenceError/i],
    isInfrastructure: true, // Treated as retriable in workflow
    isRetryable: true,
    shouldPauseQueue: false,
    message: 'Code error - Will retry with fix instructions',
  },
] as const

// =============================================================================
// SDK Crash Detection
// =============================================================================

/**
 * Pattern to detect Claude's success output in workflow logs.
 * The SDK outputs JSON lines during execution. If we see "subtype": "success"
 * in the logs, Claude completed its work successfully.
 */
const SDK_SUCCESS_PATTERN = /"subtype"\s*:\s*"success"/i

/**
 * Check if logs contain Claude's success marker.
 */
export const containsSuccessMarker = (logs: string): boolean => {
  return SDK_SUCCESS_PATTERN.test(logs)
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * ErrorClassifier service for analyzing and categorizing TDD workflow errors.
 */
export interface ErrorClassifier {
  /**
   * Classify an error based on log content.
   *
   * @param logs - Workflow logs or error message
   * @param outcome - GitHub Action outcome ('success' | 'failure' | 'cancelled')
   * @param branchExists - Whether the feature branch was created
   * @returns Classification result with error type, category, and retry guidance
   */
  readonly classify: (
    logs: string,
    outcome?: 'success' | 'failure' | 'cancelled' | 'skipped',
    branchExists?: boolean
  ) => Effect.Effect<ClassificationResult>

  /**
   * Check if error requires queue pause (credit/rate limit exhaustion).
   *
   * @param errorType - The classified error type
   * @returns true if queue should pause
   */
  readonly shouldPauseQueue: (errorType: ErrorType) => Effect.Effect<boolean>

  /**
   * Get retry category for an error type (spec vs infra).
   * Used for retry label management (retry:spec:N vs retry:infra:N).
   *
   * @param errorType - The classified error type
   * @returns 'spec' for code errors, 'infra' for infrastructure errors
   */
  readonly getRetryCategory: (errorType: ErrorType) => Effect.Effect<'spec' | 'infra'>

  /**
   * Check if logs indicate SDK crash after Claude success.
   * This is a special case where Claude completed work but SDK crashed before push.
   *
   * @param logs - Workflow logs
   * @param outcome - GitHub Action outcome
   * @param branchExists - Whether branch was created
   * @returns true if SDK crashed after Claude success
   */
  readonly detectSdkCrash: (
    logs: string,
    outcome: 'success' | 'failure' | 'cancelled' | 'skipped',
    branchExists: boolean
  ) => Effect.Effect<boolean>
}

// =============================================================================
// Service Tag
// =============================================================================

export const ErrorClassifier = Context.GenericTag<ErrorClassifier>('ErrorClassifier')

// =============================================================================
// Pure Classification Functions
// =============================================================================

/**
 * Match logs against error patterns.
 * Returns the first matching pattern or null.
 */
export const matchErrorPattern = (logs: string): ErrorPattern | null => {
  for (const pattern of ERROR_PATTERNS) {
    for (const regex of pattern.patterns) {
      if (regex.test(logs)) {
        return pattern
      }
    }
  }
  return null
}

/**
 * Classify error from logs and context.
 */
export const classifyError = (
  logs: string,
  outcome: 'success' | 'failure' | 'cancelled' | 'skipped' = 'failure',
  branchExists: boolean = false
): ClassificationResult => {
  const hasSuccessMarker = containsSuccessMarker(logs)

  // Handle success outcome
  if (outcome === 'success') {
    return {
      errorType: ErrorType.SUCCESS,
      category: ErrorCategory.SUCCESS,
      isInfrastructure: false,
      isRetryable: false,
      shouldPauseQueue: false,
      sdkCrashAfterSuccess: false,
      message: 'Claude Code completed successfully',
    }
  }

  // Handle cancelled outcome
  if (outcome === 'cancelled') {
    return {
      errorType: ErrorType.CANCELLED_TIMEOUT,
      category: ErrorCategory.INFRASTRUCTURE,
      isInfrastructure: true,
      isRetryable: true,
      shouldPauseQueue: false,
      sdkCrashAfterSuccess: false,
      message: 'Workflow was cancelled - Treating as timeout',
    }
  }

  // SDK crash detection: Success marker present but action failed
  if (hasSuccessMarker && !branchExists) {
    return {
      errorType: ErrorType.SDK_CRASH_AFTER_SUCCESS,
      category: ErrorCategory.SPECIAL,
      isInfrastructure: false,
      isRetryable: false, // Don't retry - Claude's work is done
      shouldPauseQueue: false,
      sdkCrashAfterSuccess: true,
      message: 'SDK crashed after Claude success - Work not pushed',
    }
  }

  // Post-processing 404 false negative: Branch exists despite failure
  if (outcome === 'failure' && branchExists) {
    return {
      errorType: ErrorType.POST_PROCESSING_404,
      category: ErrorCategory.SPECIAL,
      isInfrastructure: false,
      isRetryable: false,
      shouldPauseQueue: false,
      sdkCrashAfterSuccess: false,
      message: 'Post-processing 404 false negative - Branch exists',
    }
  }

  // Match against error patterns
  const matchedPattern = matchErrorPattern(logs)

  if (matchedPattern) {
    return {
      errorType: matchedPattern.type,
      category: matchedPattern.category,
      isInfrastructure: matchedPattern.isInfrastructure,
      isRetryable: matchedPattern.isRetryable,
      shouldPauseQueue: matchedPattern.shouldPauseQueue,
      sdkCrashAfterSuccess: false,
      message: matchedPattern.message,
    }
  }

  // Default: Unknown error, treat as infrastructure (retriable)
  return {
    errorType: ErrorType.CLAUDE_FAILURE,
    category: ErrorCategory.UNKNOWN,
    isInfrastructure: true,
    isRetryable: true,
    shouldPauseQueue: false,
    sdkCrashAfterSuccess: false,
    message: 'Claude failure - Will retry',
  }
}

// =============================================================================
// Service Implementation
// =============================================================================

const errorClassifierImpl: ErrorClassifier = {
  classify: (logs, outcome = 'failure', branchExists = false) =>
    Effect.succeed(classifyError(logs, outcome, branchExists)),

  shouldPauseQueue: (errorType) =>
    Effect.succeed(
      errorType === ErrorType.RATE_LIMIT_EXCEEDED ||
        errorType === ErrorType.API_OVERLOADED ||
        errorType === ErrorType.CREDIT_EXHAUSTED
    ),

  getRetryCategory: (errorType) =>
    Effect.succeed(
      errorType === ErrorType.LINT_ERROR ||
        errorType === ErrorType.TEST_FAILURE ||
        errorType === ErrorType.CODE_ERROR
        ? 'spec'
        : 'infra'
    ),

  detectSdkCrash: (logs, outcome, branchExists) =>
    Effect.succeed(outcome === 'failure' && containsSuccessMarker(logs) && !branchExists),
}

// =============================================================================
// Layer
// =============================================================================

export const ErrorClassifierLive = Layer.succeed(
  ErrorClassifier,
  ErrorClassifier.of(errorClassifierImpl)
)
