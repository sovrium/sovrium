/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Failure Comment Generator Service
 *
 * Generates Claude Code trigger comments for TDD test failures.
 * Replaces bash template logic in test.yml with type-safe TypeScript.
 */

import { Data, Effect } from 'effect'

/**
 * Error thrown when parsing failure comment context fails
 */
export class ParseFailureContextError extends Data.TaggedError('ParseFailureContextError')<{
  readonly cause: unknown
}> {}

/**
 * Failure types for TDD automation
 */
export type FailureType = 'quality_only' | 'target_only' | 'unknown'

/**
 * Context for failure comment generation
 */
export interface FailureCommentContext {
  readonly specId: string
  readonly targetSpec: string
  readonly newAttempt: number
  readonly maxAttempts: number
  readonly branch: string
  readonly failureType: FailureType
}

/**
 * Generate quality-only failure instructions
 *
 * Used when tests pass but quality checks fail (lint/typecheck/unit).
 */
function generateQualityInstructions(context: FailureCommentContext): string[] {
  return [
    '1. Run `bun run quality` to identify specific quality issues',
    '2. Fix lint, format, or type errors in production code',
    '3. Review recent changes for architecture compliance and best practices',
    '4. Eliminate code duplication if found in modified files',
    '5. Do NOT modify test files - this is a quality issue, not a test failure',
    '6. Run `bun run quality` again to verify all issues are fixed',
    `7. Run \`bun test:e2e -- ${context.targetSpec}\` to confirm tests still pass`,
    `8. Commit with message: "fix: resolve quality issues for ${context.specId}"`,
    '9. Push to origin (MANDATORY for pipeline to continue)',
  ]
}

/**
 * Generate test failure instructions
 *
 * Used when E2E tests are failing and need implementation.
 */
function generateTestFailureInstructions(context: FailureCommentContext): string[] {
  return [
    '1. Analyze the test to understand what it expects',
    '2. Implement minimal code to pass the test',
    `3. Run \`bun test:e2e -- ${context.targetSpec}\` to verify tests pass`,
    `4. Commit with message: "fix: implement ${context.specId}"`,
    '5. Push to origin (MANDATORY for pipeline to continue)',
  ]
}

/**
 * Generate constraint section
 *
 * Standard constraints for all TDD automation tasks.
 */
function generateConstraints(): string[] {
  return [
    '- NEVER modify test logic or assertions',
    '- NEVER ask clarifying questions (autonomous mode)',
    '- Maximum 3 iterations before reporting failure',
    '- Follow functional programming patterns (no push/mutation)',
  ]
}

/**
 * Generate TDD failure comment for Claude Code trigger
 *
 * Creates comment with:
 * - Agent mention (@claude agent-name)
 * - Context (spec, file, attempt, branch, failure type)
 * - Instructions (vary by failure type)
 * - Constraints (standard for all TDD tasks)
 *
 * Format matches spec: docs/development/tdd-automation-pipeline.md#system-prompt-templates
 *
 * @param context - Failure context with spec details and failure type
 * @returns Markdown comment string for Claude Code trigger
 */
export function generateFailureComment(context: FailureCommentContext): Effect.Effect<string> {
  return Effect.sync(() => {
    const lines: string[] = []

    // Determine agent based on failure type
    const agent =
      context.failureType === 'quality_only' ? 'codebase-refactor-auditor' : 'e2e-test-fixer'

    // Agent mention (triggers Claude Code)
    lines.push(`@claude ${agent}`)
    lines.push('')
    lines.push(`You are operating in the TDD automation pipeline. Use the ${agent} agent workflow.`)
    lines.push('')

    // Context section
    lines.push('**Context:**')
    lines.push(`- Spec: \`${context.specId}\``)
    lines.push(`- File: \`${context.targetSpec}\``)
    lines.push(`- Attempt: ${context.newAttempt}/${context.maxAttempts}`)
    lines.push(`- Branch: \`${context.branch}\``)
    lines.push(`- Failure Type: \`${context.failureType}\``)
    lines.push('')

    // Instructions section (varies by failure type)
    lines.push('**Instructions:**')
    const instructions =
      context.failureType === 'quality_only'
        ? generateQualityInstructions(context)
        : generateTestFailureInstructions(context)
    lines.push(...instructions)
    lines.push('')

    // Constraints section
    lines.push('**Constraints:**')
    lines.push(...generateConstraints())

    return lines.join('\n')
  })
}

/**
 * Parse failure comment context from environment variables
 *
 * Helper function to extract context from GitHub Actions outputs.
 *
 * @param env - Environment variable object
 * @returns Parsed failure comment context
 */
export function parseFailureCommentContext(
  env: Record<string, string>
): Effect.Effect<FailureCommentContext, ParseFailureContextError> {
  return Effect.try({
    try: () => {
      const specId = env['SPEC_ID'] || env['spec-id'] || env['specId'] || ''
      const targetSpec = env['TARGET_SPEC'] || env['target-spec'] || env['targetSpec'] || ''
      const newAttempt = parseInt(
        env['NEW_ATTEMPT'] || env['new-attempt'] || env['newAttempt'] || '1',
        10
      )
      const maxAttempts = parseInt(
        env['MAX_ATTEMPTS'] || env['max-attempts'] || env['maxAttempts'] || '5',
        10
      )
      const branch = env['BRANCH'] || env['branch'] || ''
      const failureType = (env['FAILURE_TYPE'] ||
        env['failure-type'] ||
        env['failureType'] ||
        'target_only') as FailureType

      if (!specId) {
        throw new Error('Missing required field: SPEC_ID')
      }

      if (!targetSpec) {
        throw new Error('Missing required field: TARGET_SPEC')
      }

      if (!branch) {
        throw new Error('Missing required field: BRANCH')
      }

      return {
        specId,
        targetSpec,
        newAttempt,
        maxAttempts,
        branch,
        failureType,
      }
    },
    catch: (cause) => new ParseFailureContextError({ cause }),
  })
}
