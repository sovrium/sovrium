/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import { Effect } from 'effect'
import {
  generateFailureComment,
  parseFailureCommentContext,
  type FailureCommentContext,
} from './failure-comment-generator'

describe('Failure Comment Generator', () => {
  describe('generateFailureComment', () => {
    test('generates comment for quality-only failure', async () => {
      const context: FailureCommentContext = {
        specId: 'UI-TABLES-001',
        targetSpec: 'specs/ui/tables/table-creation.spec.ts',
        newAttempt: 2,
        maxAttempts: 5,
        branch: 'tdd/ui-tables-001',
        failureType: 'quality_only',
      }

      const result = await Effect.runPromise(generateFailureComment(context))

      expect(result).toContain('@claude codebase-refactor-auditor')
      expect(result).toContain(
        'You are operating in the TDD automation pipeline. Use the codebase-refactor-auditor agent workflow.'
      )
      expect(result).toContain('- Spec: `UI-TABLES-001`')
      expect(result).toContain('- File: `specs/ui/tables/table-creation.spec.ts`')
      expect(result).toContain('- Attempt: 2/5')
      expect(result).toContain('- Branch: `tdd/ui-tables-001`')
      expect(result).toContain('- Failure Type: `quality_only`')
      expect(result).toContain('1. Run `bun run quality` to identify specific quality issues')
      expect(result).toContain('2. Fix lint, format, or type errors in production code')
      expect(result).toContain(
        '3. Review recent changes for architecture compliance and best practices'
      )
      expect(result).toContain('4. Eliminate code duplication if found in modified files')
      expect(result).toContain(
        '5. Do NOT modify test files - this is a quality issue, not a test failure'
      )
      expect(result).toContain('6. Run `bun run quality` again to verify all issues are fixed')
      expect(result).toContain(
        '7. Run `bun test:e2e -- specs/ui/tables/table-creation.spec.ts` to confirm tests still pass'
      )
      expect(result).toContain(
        '8. Commit with message: "fix: resolve quality issues for UI-TABLES-001"'
      )
      expect(result).toContain('9. Push to origin (MANDATORY for pipeline to continue)')
      expect(result).toContain('- NEVER modify test logic or assertions')
      expect(result).toContain('- Maximum 3 iterations before reporting failure')
    })

    test('generates comment for test failure (target_only)', async () => {
      const context: FailureCommentContext = {
        specId: 'API-USERS-002',
        targetSpec: 'specs/api/users/user-update.spec.ts',
        newAttempt: 3,
        maxAttempts: 5,
        branch: 'tdd/api-users-002',
        failureType: 'target_only',
      }

      const result = await Effect.runPromise(generateFailureComment(context))

      expect(result).toContain('@claude e2e-test-fixer')
      expect(result).toContain(
        'You are operating in the TDD automation pipeline. Use the e2e-test-fixer agent workflow.'
      )
      expect(result).toContain('- Spec: `API-USERS-002`')
      expect(result).toContain('- File: `specs/api/users/user-update.spec.ts`')
      expect(result).toContain('- Attempt: 3/5')
      expect(result).toContain('- Branch: `tdd/api-users-002`')
      expect(result).toContain('- Failure Type: `target_only`')
      expect(result).toContain('1. Analyze the test to understand what it expects')
      expect(result).toContain('2. Implement minimal code to pass the test')
      expect(result).toContain(
        '3. Run `bun test:e2e -- specs/api/users/user-update.spec.ts` to verify tests pass'
      )
      expect(result).toContain('4. Commit with message: "fix: implement API-USERS-002"')
      expect(result).toContain('5. Push to origin (MANDATORY for pipeline to continue)')
      expect(result).toContain('- NEVER modify test logic or assertions')
    })

    test('generates comment for unknown failure type (defaults to target_only)', async () => {
      const context: FailureCommentContext = {
        specId: 'UI-FORMS-003',
        targetSpec: 'specs/ui/forms/form-validation.spec.ts',
        newAttempt: 1,
        maxAttempts: 5,
        branch: 'tdd/ui-forms-003',
        failureType: 'unknown',
      }

      const result = await Effect.runPromise(generateFailureComment(context))

      // Unknown failure type should use e2e-test-fixer (not codebase-refactor-auditor)
      expect(result).toContain('@claude e2e-test-fixer')
      expect(result).toContain('- Failure Type: `unknown`')
      expect(result).toContain('1. Analyze the test to understand what it expects')
    })

    test('generates comment with first attempt', async () => {
      const context: FailureCommentContext = {
        specId: 'API-POSTS-001',
        targetSpec: 'specs/api/posts/post-creation.spec.ts',
        newAttempt: 1,
        maxAttempts: 5,
        branch: 'tdd/api-posts-001',
        failureType: 'target_only',
      }

      const result = await Effect.runPromise(generateFailureComment(context))

      expect(result).toContain('- Attempt: 1/5')
    })

    test('generates comment with last attempt', async () => {
      const context: FailureCommentContext = {
        specId: 'UI-DASHBOARD-001',
        targetSpec: 'specs/ui/dashboard/dashboard-layout.spec.ts',
        newAttempt: 5,
        maxAttempts: 5,
        branch: 'tdd/ui-dashboard-001',
        failureType: 'target_only',
      }

      const result = await Effect.runPromise(generateFailureComment(context))

      expect(result).toContain('- Attempt: 5/5')
    })
  })

  describe('parseFailureCommentContext', () => {
    test('parses context from environment variables (uppercase keys)', async () => {
      const env = {
        SPEC_ID: 'UI-TABLES-001',
        TARGET_SPEC: 'specs/ui/tables/table-creation.spec.ts',
        NEW_ATTEMPT: '2',
        MAX_ATTEMPTS: '5',
        BRANCH: 'tdd/ui-tables-001',
        FAILURE_TYPE: 'quality_only',
      }

      const result = await Effect.runPromise(parseFailureCommentContext(env))

      expect(result.specId).toBe('UI-TABLES-001')
      expect(result.targetSpec).toBe('specs/ui/tables/table-creation.spec.ts')
      expect(result.newAttempt).toBe(2)
      expect(result.maxAttempts).toBe(5)
      expect(result.branch).toBe('tdd/ui-tables-001')
      expect(result.failureType).toBe('quality_only')
    })

    test('parses context from environment variables (kebab-case keys)', async () => {
      const env = {
        'spec-id': 'API-USERS-002',
        'target-spec': 'specs/api/users/user-update.spec.ts',
        'new-attempt': '3',
        'max-attempts': '5',
        branch: 'tdd/api-users-002',
        'failure-type': 'target_only',
      }

      const result = await Effect.runPromise(parseFailureCommentContext(env))

      expect(result.specId).toBe('API-USERS-002')
      expect(result.targetSpec).toBe('specs/api/users/user-update.spec.ts')
      expect(result.newAttempt).toBe(3)
      expect(result.maxAttempts).toBe(5)
      expect(result.branch).toBe('tdd/api-users-002')
      expect(result.failureType).toBe('target_only')
    })

    test('parses context from environment variables (camelCase keys)', async () => {
      const env = {
        specId: 'UI-FORMS-003',
        targetSpec: 'specs/ui/forms/form-validation.spec.ts',
        newAttempt: '1',
        maxAttempts: '5',
        branch: 'tdd/ui-forms-003',
        failureType: 'quality_only',
      }

      const result = await Effect.runPromise(parseFailureCommentContext(env))

      expect(result.specId).toBe('UI-FORMS-003')
      expect(result.targetSpec).toBe('specs/ui/forms/form-validation.spec.ts')
      expect(result.newAttempt).toBe(1)
      expect(result.maxAttempts).toBe(5)
      expect(result.branch).toBe('tdd/ui-forms-003')
      expect(result.failureType).toBe('quality_only')
    })

    test('uses default values for attempt numbers when missing', async () => {
      const env = {
        SPEC_ID: 'API-POSTS-001',
        TARGET_SPEC: 'specs/api/posts/post-creation.spec.ts',
        BRANCH: 'tdd/api-posts-001',
      }

      const result = await Effect.runPromise(parseFailureCommentContext(env))

      expect(result.newAttempt).toBe(1)
      expect(result.maxAttempts).toBe(5)
      expect(result.failureType).toBe('target_only')
    })

    test('throws error when SPEC_ID is missing', async () => {
      const env = {
        TARGET_SPEC: 'specs/ui/tables/table-creation.spec.ts',
        BRANCH: 'tdd/ui-tables-001',
      }

      const program = parseFailureCommentContext(env)
      try {
        await Effect.runPromise(program)
        expect.unreachable('Should have thrown an error')
      } catch (error) {
        expect(String(error)).toContain('Missing required field: SPEC_ID')
      }
    })

    test('throws error when TARGET_SPEC is missing', async () => {
      const env = {
        SPEC_ID: 'UI-TABLES-001',
        BRANCH: 'tdd/ui-tables-001',
      }

      const program = parseFailureCommentContext(env)
      try {
        await Effect.runPromise(program)
        expect.unreachable('Should have thrown an error')
      } catch (error) {
        expect(String(error)).toContain('Missing required field: TARGET_SPEC')
      }
    })

    test('throws error when BRANCH is missing', async () => {
      const env = {
        SPEC_ID: 'UI-TABLES-001',
        TARGET_SPEC: 'specs/ui/tables/table-creation.spec.ts',
      }

      const program = parseFailureCommentContext(env)
      try {
        await Effect.runPromise(program)
        expect.unreachable('Should have thrown an error')
      } catch (error) {
        expect(String(error)).toContain('Missing required field: BRANCH')
      }
    })
  })
})
