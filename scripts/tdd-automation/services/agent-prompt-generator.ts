/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Agent Prompt Generator Service
 *
 * Generates specialized prompts for Claude Code agents based on failure type and conflict status.
 * Replaces complex bash template logic in claude-code.yml with type-safe TypeScript.
 */

import { Effect, type UnknownException } from 'effect'

/**
 * Agent types for TDD automation
 */
export type AgentType = 'e2e-test-fixer' | 'codebase-refactor-auditor'

/**
 * Context for agent prompt generation
 */
export interface AgentPromptContext {
  readonly agentType: AgentType
  readonly specId: string
  readonly specFile: string
  readonly hasConflict: boolean
  readonly conflictFiles?: string
}

/**
 * Generate conflict resolution prompt
 *
 * Used when merge conflicts are detected before agent execution.
 */
function generateConflictPrompt(context: AgentPromptContext): string {
  const lines: string[] = []

  lines.push('⚠️ **MERGE CONFLICT DETECTED**')
  lines.push('')
  lines.push(`Conflicted files: \`${context.conflictFiles}\``)
  lines.push('')
  lines.push('**Step 1: Resolve conflicts first**')
  lines.push('1. Run: `git fetch origin main && git merge origin/main`')
  lines.push('2. Carefully resolve each conflict:')
  lines.push('   - For DOMAIN MODEL conflicts: prefer main (newer schema)')
  lines.push('   - For TEST FILE conflicts: merge both test cases')
  lines.push('   - For CONFIG conflicts: prefer main')
  lines.push('3. After resolving, run full quality + regression tests')
  lines.push('4. If unsure about ANY conflict, add comment: `// TODO human review needed`')
  lines.push('5. Commit the resolved merge')
  lines.push('')
  lines.push('**Step 2: Use Task tool to invoke specialized agent**')
  lines.push('')
  lines.push(
    `After resolving conflicts, invoke the \`${context.agentType}\` agent via the Task tool:`
  )
  lines.push('')

  if (context.agentType === 'codebase-refactor-auditor') {
    lines.push('- Agent type: `codebase-refactor-auditor`')
    lines.push(`- Spec: \`${context.specId}\``)
    lines.push('- Instructions: Fix quality issues (lint, format, type errors)')
  } else {
    lines.push('- Agent type: `e2e-test-fixer`')
    lines.push(`- Spec: \`${context.specId}\``)
    lines.push(`- Test file: \`${context.specFile}\``)
    lines.push('- Instructions: Implement feature to make tests pass')
  }

  return lines.join('\n')
}

/**
 * Generate refactor auditor prompt
 *
 * Used when tests pass but quality checks fail.
 */
function generateRefactorPrompt(context: AgentPromptContext): string {
  const branch = `tdd/${context.specId.toLowerCase()}`
  const lines: string[] = []

  lines.push(
    'Use the Task tool to invoke the `codebase-refactor-auditor` agent to fix quality issues for this spec.'
  )
  lines.push('')
  lines.push('**Context:**')
  lines.push(`- Spec: \`${context.specId}\``)
  lines.push(`- Branch: \`${branch}\``)
  lines.push('- Failure type: Quality issues only (tests pass, but quality check fails)')
  lines.push('')
  lines.push('**Instructions for the agent:**')
  lines.push('1. Run `bun run quality` to identify specific quality issues')
  lines.push('2. Fix lint, format, or type errors in production code')
  lines.push('3. Do NOT modify test files - this is a quality issue, not a test failure')
  lines.push('4. Run `bun run quality` again to verify all issues are fixed')
  lines.push(`5. Run \`bun test:e2e -- ${context.specFile}\` to confirm tests still pass`)
  lines.push(`6. Commit with message: "fix: resolve quality issues for ${context.specId}"`)
  lines.push('7. Push to origin (MANDATORY for pipeline to continue)')
  lines.push('')
  lines.push('**Constraints:**')
  lines.push('- NEVER modify test logic or assertions')
  lines.push('- NEVER ask clarifying questions (autonomous mode)')
  lines.push('- Maximum 3 iterations before reporting failure')
  lines.push('- Follow functional programming patterns (no push/mutation)')

  return lines.join('\n')
}

/**
 * Generate E2E test fixer prompt
 *
 * Used when tests are failing and need implementation.
 */
function generateTestFixerPrompt(context: AgentPromptContext): string {
  const branch = `tdd/${context.specId.toLowerCase()}`
  const lines: string[] = []

  lines.push('Use the Task tool to invoke the `e2e-test-fixer` agent to implement this spec.')
  lines.push('')
  lines.push('**Context:**')
  lines.push(`- Spec: \`${context.specId}\``)
  lines.push(`- Test file: \`${context.specFile}\``)
  lines.push(`- Branch: \`${branch}\``)
  lines.push('')
  lines.push('**Instructions for the agent:**')
  lines.push('1. Analyze the test to understand what it expects')
  lines.push('2. Verify required schemas exist (use Skill tool if missing)')
  lines.push('3. Implement minimal code to pass the test')
  lines.push(`4. Run \`bun test:e2e -- ${context.specFile}\` to verify tests pass`)
  lines.push('5. Run `bun run quality` to ensure code quality')
  lines.push(`6. Commit with message: "fix: implement ${context.specId}"`)
  lines.push('7. Push to origin (MANDATORY for pipeline to continue)')
  lines.push('')
  lines.push('**Constraints:**')
  lines.push('- NEVER modify test logic or assertions')
  lines.push('- NEVER ask clarifying questions (autonomous mode)')
  lines.push('- Maximum 3 iterations before reporting failure')
  lines.push('- Follow functional programming patterns (no push/mutation)')

  return lines.join('\n')
}

/**
 * Generate agent invocation prompt
 *
 * Creates specialized prompt based on:
 * - Agent type (e2e-test-fixer vs codebase-refactor-auditor)
 * - Conflict status (conflicts require merge resolution first)
 * - Spec context (spec ID, test file, branch)
 *
 * @param context - Agent prompt context with spec details and status
 * @returns Markdown prompt string for Claude Code
 */
export function generateAgentPrompt(context: AgentPromptContext): Effect.Effect<string> {
  return Effect.sync(() => {
    // If conflicts exist, generate conflict resolution prompt first
    if (context.hasConflict) {
      return generateConflictPrompt(context)
    }

    // Generate agent-specific prompt based on type
    if (context.agentType === 'codebase-refactor-auditor') {
      return generateRefactorPrompt(context)
    }

    return generateTestFixerPrompt(context)
  })
}

/**
 * Parse agent prompt context from environment variables
 *
 * Helper function to extract context from GitHub Actions outputs.
 *
 * @param env - Environment variable object
 * @returns Parsed agent prompt context
 */
export function parseAgentPromptContext(
  env: Record<string, string>
): Effect.Effect<AgentPromptContext, UnknownException> {
  return Effect.try(() => {
    const agentType = (env['agent-type'] || env['agentType'] || 'e2e-test-fixer') as AgentType
    const specId = env['spec-id'] || env['specId'] || ''
    const specFile = env['spec-file'] || env['specFile'] || ''
    const hasConflict = (env['has-conflict'] || env['hasConflict']) === 'true'
    const conflictFiles = env['conflict-files'] || env['conflictFiles'] || ''

    if (!specId) {
      throw new Error('Missing required field: spec-id')
    }

    if (!specFile) {
      throw new Error('Missing required field: spec-file')
    }

    return {
      agentType,
      specId,
      specFile,
      hasConflict,
      conflictFiles: hasConflict ? conflictFiles : undefined,
    }
  })
}
