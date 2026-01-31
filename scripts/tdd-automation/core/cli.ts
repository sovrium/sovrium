/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * TDD Automation CLI Utilities
 *
 * Common patterns for CLI argument parsing, output formatting,
 * and error handling in TDD automation scripts.
 */

import { Effect, Console } from 'effect'

/**
 * Parsed CLI arguments with positional args and flags
 */
export interface ParsedArgs {
  /** Positional arguments (after filtering out flags) */
  readonly positional: readonly string[]
  /** Named flags (--key value or --flag) */
  readonly flags: Record<string, string | boolean>
}

/**
 * Parse command-line arguments
 *
 * Supports:
 * - Positional arguments: `script.ts arg1 arg2`
 * - Named flags with values: `--key value`
 * - Boolean flags: `--flag`
 * - Short flags: `-f value` or `-f`
 *
 * @param argv - Command-line arguments (usually process.argv.slice(2))
 * @returns Parsed arguments object
 *
 * @example
 * ```typescript
 * // bun run script.ts --pr-number 123 --dry-run spec.ts
 * const args = parseArgs(process.argv.slice(2))
 * // args.flags['pr-number'] === '123'
 * // args.flags['dry-run'] === true
 * // args.positional === ['spec.ts']
 * ```
 */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!

    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const nextArg = argv[i + 1]

      // Check if next arg is a value or another flag
      if (nextArg && !nextArg.startsWith('-')) {
        flags[key] = nextArg
        i++ // Skip next arg
      } else {
        flags[key] = true
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1)
      const nextArg = argv[i + 1]

      if (nextArg && !nextArg.startsWith('-')) {
        flags[key] = nextArg
        i++
      } else {
        flags[key] = true
      }
    } else {
      positional.push(arg)
    }
  }

  return { positional, flags }
}

/**
 * Get a required environment variable
 *
 * @param name - Environment variable name
 * @returns Effect that succeeds with value or fails with error message
 *
 * @example
 * ```typescript
 * const token = yield* getRequiredEnv('GH_TOKEN')
 * ```
 */
export function getRequiredEnv(name: string): Effect.Effect<string, string> {
  const value = process.env[name]
  if (!value) {
    return Effect.fail(`Missing required environment variable: ${name}`)
  }
  return Effect.succeed(value)
}

/**
 * Get an optional environment variable with default
 *
 * @param name - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns Environment variable value or default
 *
 * @example
 * ```typescript
 * const baseRef = getEnvOrDefault('BASE_REF', 'main')
 * ```
 */
export function getEnvOrDefault(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue
}

/**
 * Get a required positional argument
 *
 * @param args - Parsed arguments
 * @param index - Position index (0-based)
 * @param name - Argument name for error message
 * @returns Effect that succeeds with value or fails with usage error
 *
 * @example
 * ```typescript
 * const prNumber = yield* getRequiredArg(args, 0, 'pr-number')
 * ```
 */
export function getRequiredArg(
  args: ParsedArgs,
  index: number,
  name: string
): Effect.Effect<string, string> {
  const value = args.positional[index]
  if (!value) {
    return Effect.fail(`Missing required argument: <${name}>`)
  }
  return Effect.succeed(value)
}

/**
 * Parse a positional argument as a number
 *
 * @param args - Parsed arguments
 * @param index - Position index
 * @param name - Argument name for error message
 * @returns Effect that succeeds with number or fails with error
 *
 * @example
 * ```typescript
 * const prNumber = yield* parseNumberArg(args, 0, 'pr-number')
 * ```
 */
export function parseNumberArg(
  args: ParsedArgs,
  index: number,
  name: string
): Effect.Effect<number, string> {
  return Effect.gen(function* () {
    const value = yield* getRequiredArg(args, index, name)
    const num = Number(value)

    if (Number.isNaN(num)) {
      return yield* Effect.fail(`Invalid ${name}: "${value}" is not a number`)
    }

    return num
  })
}

/**
 * CLI output result type
 */
export interface CLIResult<T> {
  readonly success: boolean
  readonly data?: T
  readonly error?: string
}

/**
 * Output JSON result to stdout (for workflow parsing)
 *
 * @param data - Data to output as JSON
 *
 * @example
 * ```typescript
 * outputJSON({ prNumber: 123, specId: 'API-001' })
 * // Outputs: {"prNumber":123,"specId":"API-001"}
 * ```
 */
export function outputJSON<T>(data: T): Effect.Effect<void> {
  return Console.log(JSON.stringify(data))
}

/**
 * Output error JSON to stdout (for workflow parsing)
 *
 * @param error - Error message or object
 *
 * @example
 * ```typescript
 * outputErrorJSON('Failed to fetch PR')
 * // Outputs: {"success":false,"error":"Failed to fetch PR"}
 * ```
 */
export function outputErrorJSON(error: string | Error): Effect.Effect<void> {
  const message = error instanceof Error ? error.message : error
  return Console.log(JSON.stringify({ success: false, error: message }))
}

/**
 * Log message to stderr (doesn't interfere with JSON output)
 *
 * @param message - Message to log
 * @param prefix - Optional prefix emoji/label
 *
 * @example
 * ```typescript
 * yield* logInfo('Processing PR #123')  // stderr: ℹ️ Processing PR #123
 * yield* logSuccess('Done!')            // stderr: ✅ Done!
 * yield* logWarning('No specs found')   // stderr: ⚠️ No specs found
 * yield* logError('Failed')             // stderr: ❌ Failed
 * ```
 */
export function logInfo(message: string): Effect.Effect<void> {
  return Console.error(`ℹ️  ${message}`)
}

export function logSuccess(message: string): Effect.Effect<void> {
  return Console.error(`✅ ${message}`)
}

export function logWarning(message: string): Effect.Effect<void> {
  return Console.error(`⚠️  ${message}`)
}

export function logError(message: string): Effect.Effect<void> {
  return Console.error(`❌ ${message}`)
}

export function logDebug(message: string): Effect.Effect<void> {
  return Console.error(`🔍 ${message}`)
}

/**
 * Create a CLI program wrapper with standard error handling
 *
 * Handles:
 * - Effect execution
 * - Error logging to stderr
 * - JSON output to stdout
 * - Exit codes (0 for success, 1 for failure)
 *
 * @param program - Effect program that returns data to output
 * @returns Promise that resolves when CLI is done
 *
 * @example
 * ```typescript
 * const main = Effect.gen(function* () {
 *   const github = yield* GitHubApi
 *   const pr = yield* github.getPR(123)
 *   return { prNumber: pr.number, title: pr.title }
 * }).pipe(Effect.provide(GitHubApiLive))
 *
 * runCLI(main)
 * ```
 */
export async function runCLI<T, E>(program: Effect.Effect<T, E, never>): Promise<void> {
  const result = await Effect.runPromise(
    program.pipe(
      Effect.match({
        onSuccess: (data) => {
          console.log(JSON.stringify(data))
          process.exit(0)
        },
        onFailure: (error) => {
          const message = error instanceof Error ? error.message : String(error)
          console.error(`❌ Error: ${message}`)
          console.log(JSON.stringify({ success: false, error: message }))
          process.exit(1)
        },
      })
    )
  )

  return result
}

/**
 * Create usage documentation for a CLI script
 *
 * @param scriptName - Script name
 * @param description - Script description
 * @param usage - Usage pattern
 * @param options - List of options with descriptions
 *
 * @example
 * ```typescript
 * printUsage(
 *   'update-pr-title.ts',
 *   'Increment attempt counter in TDD PR title',
 *   'bun run update-pr-title.ts <pr-number>',
 *   [
 *     { name: '<pr-number>', description: 'PR number to update' },
 *     { name: '--dry-run', description: 'Show changes without applying' },
 *   ]
 * )
 * ```
 */
export function printUsage(
  scriptName: string,
  description: string,
  usage: string,
  options: readonly { name: string; description: string }[] = []
): void {
  console.error(`${description}`)
  console.error('')
  console.error(`Usage: ${usage}`)

  if (options.length > 0) {
    console.error('')
    console.error('Options:')
    const maxLen = Math.max(...options.map((o) => o.name.length))
    for (const opt of options) {
      console.error(`  ${opt.name.padEnd(maxLen + 2)}${opt.description}`)
    }
  }

  console.error('')
  console.error('Environment:')
  console.error('  GITHUB_REPOSITORY    owner/repo format')
  console.error('  GH_TOKEN             GitHub API token')
}
