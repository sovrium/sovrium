/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { $ } from 'bun'
import { Effect, Console } from 'effect'

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
    fastPath: hasFlag('fast-path'),
    pr: getOption('pr') ? parseInt(getOption('pr')!) : undefined,
  }
}

// Helper to log to stderr (so it doesn't interfere with stdout capture in shell)
const logStderr = (message: string) =>
  Effect.sync(() => {
    process.stderr.write(message + '\n')
  })

const createPR = ({
  file,
  branch: _branch,
  specId,
  retryCount,
  fastPath,
}: {
  file: string
  branch: string
  specId?: string
  retryCount?: number
  fastPath: boolean
}) =>
  Effect.gen(function* () {
    const specName = specId ?? file.split('/').pop()?.replace('.spec.ts', '')

    if (fastPath) {
      yield* logStderr(`🚀 Creating fast-path PR: ${specName} passes without implementation`)

      const title = `test: remove .fixme() from ${specName}`
      const body = `## Fast Path ⚡

Spec \`${specName}\` in \`${file}\` passes without implementation.

### Changes
- Removed \`.fixme()\` from ${specName}

### Summary
Test was already passing, no implementation needed.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>`

      const result = yield* Effect.tryPromise({
        try: async () => {
          const proc = await $`gh pr create --title ${title} --body ${body}`.quiet().nothrow()
          return {
            exitCode: proc.exitCode,
            stdout: proc.stdout.toString(),
            stderr: proc.stderr.toString(),
          }
        },
        catch: (error) => new Error(`Failed to create PR: ${error}`),
      })

      if (result.exitCode !== 0) {
        yield* logStderr(`❌ Failed to create PR: ${result.stderr}`)
        return yield* Effect.fail(new Error('Failed to create PR'))
      }

      // Extract PR number from output (gh pr create outputs the URL)
      const prUrlMatch = result.stdout.match(/https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/)
      const prNumber = prUrlMatch ? prUrlMatch[1] : ''

      yield* logStderr(result.stdout.trim()) // Log the URL to stderr
      yield* logStderr(`✅ PR created: #${prNumber}`)

      // Only output PR number to stdout for shell capture
      yield* Console.log(prNumber)

      return prNumber
    } else {
      yield* logStderr(`📝 Creating implementation PR for ${specName}`)

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
          const proc = await $`gh pr create --title ${title} --body ${body}`.quiet().nothrow()
          return {
            exitCode: proc.exitCode,
            stdout: proc.stdout.toString(),
            stderr: proc.stderr.toString(),
          }
        },
        catch: (error) => new Error(`Failed to create PR: ${error}`),
      })

      if (result.exitCode !== 0) {
        yield* logStderr(`❌ Failed to create PR: ${result.stderr}`)
        return yield* Effect.fail(new Error('Failed to create PR'))
      }

      // Extract PR number from output (gh pr create outputs the URL)
      const prUrlMatch = result.stdout.match(/https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/)
      const prNumber = prUrlMatch ? prUrlMatch[1] : ''

      yield* logStderr(result.stdout.trim()) // Log the URL to stderr
      yield* logStderr(`✅ PR created: #${prNumber}`)

      // Only output PR number to stdout for shell capture
      yield* Console.log(prNumber)

      return prNumber
    }
  })

const mergePR = ({ pr }: { pr: number }) =>
  Effect.gen(function* () {
    yield* logStderr(`🔀 Auto-merging PR #${pr}`)

    const result = yield* Effect.tryPromise({
      try: async () => {
        const proc = await $`gh pr merge ${pr} --squash --auto`.quiet().nothrow()
        return {
          exitCode: proc.exitCode,
          stdout: proc.stdout.toString(),
          stderr: proc.stderr.toString(),
        }
      },
      catch: (error) => new Error(`Failed to merge PR: ${error}`),
    })

    if (result.exitCode !== 0) {
      yield* logStderr(`❌ Failed to enable auto-merge: ${result.stderr}`)
      return yield* Effect.fail(new Error('Failed to enable auto-merge'))
    }

    yield* logStderr(`✅ Auto-merge enabled for PR #${pr}`)
    yield* logStderr(`PR will merge automatically when CI checks pass`)
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
