/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import { Command, Args, Options } from '@effect/cli'
import { $ } from 'bun'

type AgentType = 'e2e-test-fixer' | 'codebase-refactor-auditor'

const ClaudeInvokerCommand = Command.make(
  'claude-invoker',
  {
    agent: Options.text('agent'),
    file: Options.text('file').pipe(Options.optional),
    context: Options.text('context').pipe(Options.optional),
    retryCount: Options.integer('retry-count').pipe(Options.optional),
  },
  ({ agent, file, context, retryCount }) =>
    Effect.gen(function* () {
      const agentType = agent as AgentType

      yield* Console.log(`🤖 Invoking Claude Code agent: ${agentType}`)

      // Build prompt based on agent type
      let prompt = ''

      if (agentType === 'e2e-test-fixer' && file) {
        const retryInfo =
          retryCount !== undefined && retryCount > 0
            ? `\n\nThis is retry attempt ${retryCount + 1}/3.`
            : ''

        const previousErrors = context && context !== '[]' ? `\n\nPrevious errors:\n${context}` : ''

        prompt = `Implement the tests in ${file}.

The .fixme() markers have been removed from the tests. Your task is to:
1. Read the test file to understand what needs to be implemented
2. Implement the minimum code required to make all tests in this file pass
3. Follow TDD principles: only implement what the tests require
4. Run quality checks after implementation${retryInfo}${previousErrors}

Use the e2e-test-fixer agent to complete this task.`
      } else if (agentType === 'codebase-refactor-auditor') {
        prompt = `Review the recent code changes and refactor if needed.

The implementation has been completed. Your task is to:
1. Review code in src/ for quality issues
2. Eliminate any code duplication
3. Ensure layer architecture is correct
4. Verify that quality checks pass

Use the codebase-refactor-auditor agent to complete this task.`
      } else {
        return yield* Effect.fail(new Error(`Unknown agent type: ${agentType}`))
      }

      yield* Console.log(`📝 Prompt: ${prompt}`)

      // Invoke Claude Code
      const result = yield* Effect.tryPromise({
        try: async () => {
          const proc = await $`claude ${prompt}`.nothrow()
          return {
            exitCode: proc.exitCode,
            stdout: proc.stdout.toString(),
            stderr: proc.stderr.toString(),
          }
        },
        catch: (error) => new Error(`Failed to invoke Claude: ${error}`),
      })

      if (result.exitCode !== 0) {
        yield* Console.error(`❌ Claude invocation failed`)
        yield* Console.error(result.stderr)
        return yield* Effect.fail(new Error('Claude invocation failed'))
      }

      yield* Console.log(`✅ Claude Code agent completed successfully`)
      yield* Console.log(result.stdout)
    })
)

const program = ClaudeInvokerCommand

Effect.runPromise(program).catch((error) => {
  console.error('Claude invoker failed:', error)
  process.exit(1)
})
