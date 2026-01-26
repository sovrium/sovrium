/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import { $ } from 'bun'

// Parse command line arguments manually
function parseArgs() {
  const args = process.argv.slice(2)
  const command = args[0] // 'create' or 'merge'

  const getOption = (name: string): string | undefined => {
    const withEquals = args.find((arg) => arg.startsWith(`--${name}=`))
    if (withEquals) return withEquals.split('=')[1]

    const index = args.indexOf(`--${name}`)
    if (index !== -1 && args[index + 1]) return args[index + 1]

    return undefined
  }

  const hasFlag = (name: string): boolean => {
    return args.includes(`--${name}`)
  }

  return {
    command,
    file: getOption('file'),
    branch: getOption('branch'),
    specId: getOption('spec-id'),
    retryCount: getOption('retry-count') ? parseInt(getOption('retry-count')!) : undefined,
    testCount: getOption('test-count') ? parseInt(getOption('test-count')!) : undefined,
    fastPath: hasFlag('fast-path'),
    pr: getOption('pr') ? parseInt(getOption('pr')!) : undefined,
  }
}

const createPR = ({ file, branch, specId, retryCount, testCount, fastPath }: {
  file: string
  branch: string
  specId?: string
  retryCount?: number
  testCount?: number
  fastPath: boolean
}) =>
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

const mergePR = ({ pr }: { pr: number }) =>
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

// Main program - parse args and run appropriate command
const program = Effect.gen(function* () {
  const parsedArgs = parseArgs()

  if (!parsedArgs.command) {
    console.error('Error: command required (create or merge)')
    process.exit(1)
  }

  if (parsedArgs.command === 'create') {
    if (!parsedArgs.file || !parsedArgs.branch) {
      console.error('Error: --file and --branch are required for create command')
      process.exit(1)
    }

    return yield* createPR({
      file: parsedArgs.file,
      branch: parsedArgs.branch,
      specId: parsedArgs.specId,
      retryCount: parsedArgs.retryCount,
      testCount: parsedArgs.testCount,
      fastPath: parsedArgs.fastPath,
    })
  } else if (parsedArgs.command === 'merge') {
    if (!parsedArgs.pr) {
      console.error('Error: --pr is required for merge command')
      process.exit(1)
    }

    return yield* mergePR({ pr: parsedArgs.pr })
  } else {
    console.error(`Error: unknown command '${parsedArgs.command}'`)
    process.exit(1)
  }
})

Effect.runPromise(program).catch((error) => {
  console.error('PR manager failed:', error)
  process.exit(1)
})
