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
    test('generates e2e-test-fixer prompt without conflicts', async () => {
      const context: AgentPromptContext = {
        agentType: 'e2e-test-fixer',
        specId: 'UI-TABLES-001',
        specFile: 'specs/ui/tables/table-creation.spec.ts',
        hasConflict: false,
      }

      const result = await Effect.runPromise(generateAgentPrompt(context))

      expect(result).toContain('Use the Task tool to invoke the `e2e-test-fixer` agent')
      expect(result).toContain('- Spec: `UI-TABLES-001`')
      expect(result).toContain('- Test file: `specs/ui/tables/table-creation.spec.ts`')
      expect(result).toContain('- Branch: `tdd/ui-tables-001`')
      expect(result).toContain('1. Analyze the test to understand what it expects')
      expect(result).toContain('2. Verify required schemas exist (use Skill tool if missing)')
      expect(result).toContain(
        '4. Run `bun test:e2e -- specs/ui/tables/table-creation.spec.ts` to verify tests pass'
      )
      expect(result).toContain('6. Commit with message: "fix: implement UI-TABLES-001"')
      expect(result).toContain('- NEVER modify test logic or assertions')
      expect(result).toContain('- Maximum 3 iterations before reporting failure')
    })

    test('generates codebase-refactor-auditor prompt without conflicts', async () => {
      const context: AgentPromptContext = {
        agentType: 'codebase-refactor-auditor',
        specId: 'API-USERS-002',
        specFile: 'specs/api/users/user-update.spec.ts',
        hasConflict: false,
      }

      const result = await Effect.runPromise(generateAgentPrompt(context))

      expect(result).toContain('Use the Task tool to invoke the `codebase-refactor-auditor` agent')
      expect(result).toContain('- Spec: `API-USERS-002`')
      expect(result).toContain('- Branch: `tdd/api-users-002`')
      expect(result).toContain('- Failure type: Quality issues only')
      expect(result).toContain('1. Run `bun run quality` to identify specific quality issues')
      expect(result).toContain(
        '3. Do NOT modify test files - this is a quality issue, not a test failure'
      )
      expect(result).toContain('4. Run `bun run quality` again to verify all issues are fixed')
      expect(result).toContain(
        '6. Commit with message: "fix: resolve quality issues for API-USERS-002"'
      )
      expect(result).toContain('- NEVER modify test logic or assertions')
    })

    test('generates conflict resolution prompt when conflicts exist', async () => {
      const context: AgentPromptContext = {
        agentType: 'e2e-test-fixer',
        specId: 'API-POSTS-003',
        specFile: 'specs/api/posts/post-creation.spec.ts',
        hasConflict: true,
        conflictFiles: 'src/domain/models/post.ts, specs/api/posts/post-creation.spec.ts',
      }

      const result = await Effect.runPromise(generateAgentPrompt(context))

      expect(result).toContain('⚠️ **MERGE CONFLICT DETECTED**')
      expect(result).toContain(
        'Conflicted files: `src/domain/models/post.ts, specs/api/posts/post-creation.spec.ts`'
      )
      expect(result).toContain('**Step 1: Resolve conflicts first**')
      expect(result).toContain('1. Run: `git fetch origin main && git merge origin/main`')
      expect(result).toContain('- For DOMAIN MODEL conflicts: prefer main (newer schema)')
      expect(result).toContain('- For TEST FILE conflicts: merge both test cases')
      expect(result).toContain('**Step 2: Use Task tool to invoke specialized agent**')
      expect(result).toContain('- Agent type: `e2e-test-fixer`')
      expect(result).toContain('- Spec: `API-POSTS-003`')
      expect(result).toContain('- Test file: `specs/api/posts/post-creation.spec.ts`')
    })

    test('generates conflict resolution prompt for refactor auditor', async () => {
      const context: AgentPromptContext = {
        agentType: 'codebase-refactor-auditor',
        specId: 'UI-FORMS-005',
        specFile: 'specs/ui/forms/form-validation.spec.ts',
        hasConflict: true,
        conflictFiles: 'src/presentation/components/forms/FormField.tsx',
      }

      const result = await Effect.runPromise(generateAgentPrompt(context))

      expect(result).toContain('⚠️ **MERGE CONFLICT DETECTED**')
      expect(result).toContain(
        'Conflicted files: `src/presentation/components/forms/FormField.tsx`'
      )
      expect(result).toContain('- Agent type: `codebase-refactor-auditor`')
      expect(result).toContain('- Spec: `UI-FORMS-005`')
      expect(result).toContain('- Instructions: Fix quality issues (lint, format, type errors)')
    })
  })

  describe('parseAgentPromptContext', () => {
    test('parses context from environment variables with kebab-case keys', async () => {
      const env = {
        'agent-type': 'e2e-test-fixer',
        'spec-id': 'UI-TABLES-001',
        'spec-file': 'specs/ui/tables/table-creation.spec.ts',
        'has-conflict': 'false',
      }

      const result = await Effect.runPromise(parseAgentPromptContext(env))

      expect(result.agentType).toBe('e2e-test-fixer')
      expect(result.specId).toBe('UI-TABLES-001')
      expect(result.specFile).toBe('specs/ui/tables/table-creation.spec.ts')
      expect(result.hasConflict).toBe(false)
      expect(result.conflictFiles).toBeUndefined()
    })

    test('parses context from environment variables with camelCase keys', async () => {
      const env = {
        agentType: 'codebase-refactor-auditor',
        specId: 'API-USERS-002',
        specFile: 'specs/api/users/user-update.spec.ts',
        hasConflict: 'false',
      }

      const result = await Effect.runPromise(parseAgentPromptContext(env))

      expect(result.agentType).toBe('codebase-refactor-auditor')
      expect(result.specId).toBe('API-USERS-002')
      expect(result.specFile).toBe('specs/api/users/user-update.spec.ts')
      expect(result.hasConflict).toBe(false)
    })

    test('parses conflict context correctly', async () => {
      const env = {
        'agent-type': 'e2e-test-fixer',
        'spec-id': 'API-POSTS-003',
        'spec-file': 'specs/api/posts/post-creation.spec.ts',
        'has-conflict': 'true',
        'conflict-files': 'src/domain/models/post.ts, specs/api/posts/post-creation.spec.ts',
      }

      const result = await Effect.runPromise(parseAgentPromptContext(env))

      expect(result.hasConflict).toBe(true)
      expect(result.conflictFiles).toBe(
        'src/domain/models/post.ts, specs/api/posts/post-creation.spec.ts'
      )
    })

    test('uses default agent type when not specified', async () => {
      const env = {
        'spec-id': 'UI-FORMS-001',
        'spec-file': 'specs/ui/forms/form-validation.spec.ts',
        'has-conflict': 'false',
      }

      const result = await Effect.runPromise(parseAgentPromptContext(env))

      expect(result.agentType).toBe('e2e-test-fixer')
    })

    test('throws error when spec-id is missing', async () => {
      const env = {
        'agent-type': 'e2e-test-fixer',
        'spec-file': 'specs/ui/tables/table-creation.spec.ts',
        'has-conflict': 'false',
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
        'has-conflict': 'false',
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
