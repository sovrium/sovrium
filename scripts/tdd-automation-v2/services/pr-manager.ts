/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import { Command, Args, Options } from '@effect/cli'
import { $ } from 'bun'

const CreatePRCommand = Command.make(
  'create',
  {
    file: Args.text({ name: 'file' }),
    branch: Args.text({ name: 'branch' }),
    specId: Options.text('spec-id').pipe(Options.optional),
    retryCount: Options.integer('retry-count').pipe(Options.optional),
    testCount: Options.integer('test-count').pipe(Options.optional),
    fastPath: Options.boolean('fast-path').pipe(Options.withDefault(false)),
  },
  ({ file, branch, specId, retryCount, testCount, fastPath }) =>
    Effect.gen(function* () {
      const specName = specId ?? file.split('/').pop()?.replace('.spec.ts', '')

      if (fastPath && testCount !== undefined) {
        yield* Console.log(
          `🚀 Creating fast-path PR: ${testCount} tests pass without implementation`
        )

        const title = `test: remove .fixme() from ${file}`
        const body = `## Fast Path ⚡

All ${testCount} test(s) in \`${file}\` pass without implementation.

### Changes
- Removed \`.fixme()\` from all tests

### Summary
Tests were already passing, no implementation needed.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>`

        const result = yield* Effect.tryPromise({
          try: async () => {
            const proc =
              await $`gh pr create --title ${title} --body ${body} --label tdd-automation-v2 --label fast-path`.nothrow()
            return {
              exitCode: proc.exitCode,
              stdout: proc.stdout.toString(),
            }
          },
          catch: (error) => new Error(`Failed to create PR: ${error}`),
        })

        if (result.exitCode !== 0) {
          return yield* Effect.fail(new Error('Failed to create PR'))
        }

        // Extract PR number from output
        const prUrlMatch = result.stdout.match(/https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/)
        const prNumber = prUrlMatch ? prUrlMatch[1] : ''

        yield* Console.log(`✅ PR created: #${prNumber}`)
        yield* Console.log(prNumber) // Output PR number for GitHub Actions

        return prNumber
      } else {
        yield* Console.log(`📝 Creating implementation PR for ${specName}`)

        const retryInfo =
          retryCount !== undefined && retryCount > 0
            ? `\n\n**Retry**: Attempt ${retryCount + 1}/3`
            : ''

        const title = `feat: implement ${specName}`
        const body = `## Implementation

Implements tests from \`${file}\`.${retryInfo}

### Changes
- Removed \`.fixme()\` from tests
- Implemented required functionality
- Ran quality checks and added license headers

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>`

        const result = yield* Effect.tryPromise({
          try: async () => {
            const proc =
              await $`gh pr create --title ${title} --body ${body} --label tdd-automation-v2`.nothrow()
            return {
              exitCode: proc.exitCode,
              stdout: proc.stdout.toString(),
            }
          },
          catch: (error) => new Error(`Failed to create PR: ${error}`),
        })

        if (result.exitCode !== 0) {
          return yield* Effect.fail(new Error('Failed to create PR'))
        }

        // Extract PR number from output
        const prUrlMatch = result.stdout.match(/https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/)
        const prNumber = prUrlMatch ? prUrlMatch[1] : ''

        yield* Console.log(`✅ PR created: #${prNumber}`)
        yield* Console.log(prNumber) // Output PR number for GitHub Actions

        return prNumber
      }
    })
)

const MergePRCommand = Command.make(
  'merge',
  {
    pr: Options.integer('pr'),
  },
  ({ pr }) =>
    Effect.gen(function* () {
      yield* Console.log(`🔀 Auto-merging PR #${pr}`)

      const result = yield* Effect.tryPromise({
        try: async () => {
          const proc = await $`gh pr merge ${pr} --squash --auto`.nothrow()
          return {
            exitCode: proc.exitCode,
            stdout: proc.stdout.toString(),
          }
        },
        catch: (error) => new Error(`Failed to merge PR: ${error}`),
      })

      if (result.exitCode !== 0) {
        return yield* Effect.fail(new Error('Failed to enable auto-merge'))
      }

      yield* Console.log(`✅ Auto-merge enabled for PR #${pr}`)
      yield* Console.log(`PR will merge automatically when CI checks pass`)
    })
)

const program = Command.make('pr-manager').pipe(
  Command.withSubcommands([CreatePRCommand, MergePRCommand])
)

Effect.runPromise(program).catch((error) => {
  console.error('PR manager failed:', error)
  process.exit(1)
})
