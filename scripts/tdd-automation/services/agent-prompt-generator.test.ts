/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import { Effect } from 'effect'
import {
  generateAgentPrompt,
  parseAgentPromptContext,
  type AgentPromptContext,
} from './agent-prompt-generator'

describe('Agent Prompt Generator', () => {
  describe('generateAgentPrompt', () => {
    test('generates e2e-test-fixer prompt', async () => {
      const context: AgentPromptContext = {
        agentType: 'e2e-test-fixer',
        specId: 'UI-TABLES-001',
        specFile: 'specs/ui/tables/table-creation.spec.ts',
      }

      const result = await Effect.runPromise(generateAgentPrompt(context))

      expect(result).toContain('Use the Task tool to invoke the `e2e-test-fixer` agent')
      expect(result).toContain('- Spec: `UI-TABLES-001`')
      expect(result).toContain('- Test file: `specs/ui/tables/table-creation.spec.ts`')
      expect(result).toContain('- Branch: `tdd/ui-tables-001`')
      expect(result).toContain('1. Analyze the test to understand what it expects')
      expect(result).toContain('2. Implement minimal code to pass the test')
      expect(result).toContain(
        '3. Run `bun test:e2e -- specs/ui/tables/table-creation.spec.ts` to verify tests pass'
      )
      expect(result).toContain('4. Commit with message: "fix: implement UI-TABLES-001"')
      expect(result).toContain('- NEVER modify test logic or assertions')
      expect(result).toContain('- Maximum 3 iterations before reporting failure')
    })

    test('generates codebase-refactor-auditor prompt', async () => {
      const context: AgentPromptContext = {
        agentType: 'codebase-refactor-auditor',
        specId: 'API-USERS-002',
        specFile: 'specs/api/users/user-update.spec.ts',
      }

      const result = await Effect.runPromise(generateAgentPrompt(context))

      expect(result).toContain('Use the Task tool to invoke the `codebase-refactor-auditor` agent')
      expect(result).toContain('- Spec: `API-USERS-002`')
      expect(result).toContain('- Branch: `tdd/api-users-002`')
      expect(result).toContain('- Failure type: Quality issues only')
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
        '8. Commit with message: "fix: resolve quality issues for API-USERS-002"'
      )
      expect(result).toContain(
        "- Focus on files modified in this spec (don't refactor unrelated code)"
      )
      expect(result).toContain('- NEVER modify test logic or assertions')
    })
  })

  describe('parseAgentPromptContext', () => {
    test('parses context from environment variables with kebab-case keys', async () => {
      const env = {
        'agent-type': 'e2e-test-fixer',
        'spec-id': 'UI-TABLES-001',
        'spec-file': 'specs/ui/tables/table-creation.spec.ts',
      }

      const result = await Effect.runPromise(parseAgentPromptContext(env))

      expect(result.agentType).toBe('e2e-test-fixer')
      expect(result.specId).toBe('UI-TABLES-001')
      expect(result.specFile).toBe('specs/ui/tables/table-creation.spec.ts')
    })

    test('parses context from environment variables with camelCase keys', async () => {
      const env = {
        agentType: 'codebase-refactor-auditor',
        specId: 'API-USERS-002',
        specFile: 'specs/api/users/user-update.spec.ts',
      }

      const result = await Effect.runPromise(parseAgentPromptContext(env))

      expect(result.agentType).toBe('codebase-refactor-auditor')
      expect(result.specId).toBe('API-USERS-002')
      expect(result.specFile).toBe('specs/api/users/user-update.spec.ts')
    })

    test('uses default agent type when not specified', async () => {
      const env = {
        'spec-id': 'UI-FORMS-001',
        'spec-file': 'specs/ui/forms/form-validation.spec.ts',
      }

      const result = await Effect.runPromise(parseAgentPromptContext(env))

      expect(result.agentType).toBe('e2e-test-fixer')
    })

    test('throws error when spec-id is missing', async () => {
      const env = {
        'agent-type': 'e2e-test-fixer',
        'spec-file': 'specs/ui/tables/table-creation.spec.ts',
      }

      const program = parseAgentPromptContext(env)
      try {
        await Effect.runPromise(program)
        expect.unreachable('Should have thrown an error')
      } catch (error) {
        expect(String(error)).toContain('Missing required field: spec-id')
      }
    })

    test('throws error when spec-file is missing', async () => {
      const env = {
        'agent-type': 'e2e-test-fixer',
        'spec-id': 'UI-TABLES-001',
      }

      const program = parseAgentPromptContext(env)
      try {
        await Effect.runPromise(program)
        expect.unreachable('Should have thrown an error')
      } catch (error) {
        expect(String(error)).toContain('Missing required field: spec-file')
      }
    })
  })
})
