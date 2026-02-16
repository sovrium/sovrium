/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { execSync as nodeExecSync } from 'node:child_process'
import { spawn as bunSpawn } from 'bun'
import * as Context from 'effect/Context'
import * as Data from 'effect/Data'
import * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Schedule from 'effect/Schedule'

/**
 * Command Execution Error Types
 */
export class CommandFailedError extends Data.TaggedError('CommandFailedError')<{
  readonly command: string
  readonly exitCode: number
  readonly stderr: string
  readonly stdout: string
}> {}

export class CommandTimeoutError extends Data.TaggedError('CommandTimeoutError')<{
  readonly command: string
  readonly timeoutMs: number
}> {}

export class CommandSpawnError extends Data.TaggedError('CommandSpawnError')<{
  readonly command: string
  readonly cause?: unknown
}> {}

/**
 * Command execution result
 */
export interface CommandResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
  readonly duration: number
}

/**
 * Command execution options
 */
export interface CommandOptions {
  /** Timeout in milliseconds (default: 60000ms = 60s) */
  readonly timeout?: number
  /** Working directory */
  readonly cwd?: string
  /** Environment variables */
  readonly env?: Record<string, string>
  /** Retry schedule (default: no retry) */
  readonly retry?: Schedule.Schedule<unknown, unknown, never>
  /** Whether to throw on non-zero exit code (default: true) */
  readonly throwOnError?: boolean
  /** Enable verbose logging (default: false) */
  readonly verbose?: boolean
}

/**
 * Command Service Interface
 */
export interface CommandService {
  /**
   * Execute command using Bun.spawn (async, non-blocking)
   * @param command - Command as array (e.g., ['bun', 'test', 'file.ts'])
   * @param options - Execution options
   * @returns Effect that resolves to CommandResult
   */
  readonly spawn: (
    command: readonly string[],
    options?: CommandOptions
  ) => Effect.Effect<CommandResult, CommandFailedError | CommandTimeoutError | CommandSpawnError>

  /**
   * Execute command using execSync (sync, blocking)
   * Useful for simple commands that need synchronous execution
   * @param command - Command as string (e.g., 'git status')
   * @param options - Execution options
   * @returns Effect that resolves to string output
   */
  readonly exec: (
    command: string,
    options?: CommandOptions
  ) => Effect.Effect<string, CommandFailedError>

  /**
   * Execute multiple commands in parallel
   * @param commands - Array of [command, options] tuples
   * @returns Effect that resolves to array of CommandResults
   */
  readonly parallel: <E, R>(
    commands: readonly Effect.Effect<CommandResult, E, R>[]
  ) => Effect.Effect<readonly CommandResult[], E, R>

  /**
   * Execute command with GitHub Actions output support
   * Writes to GITHUB_OUTPUT if running in GitHub Actions
   * @param name - Output variable name
   * @param command - Command to execute
   * @param options - Execution options
   * @returns Effect that resolves to CommandResult
   */
  readonly withGitHubOutput: (
    name: string,
    command: readonly string[],
    options?: CommandOptions
  ) => Effect.Effect<CommandResult, CommandFailedError | CommandTimeoutError | CommandSpawnError>
}

/**
 * Command Service Tag (for dependency injection)
 */
export const CommandService = Context.GenericTag<CommandService>('CommandService')

/**
 * Get environment with PATH extended to include common tool locations
 * Ensures commands like 'gh' (GitHub CLI) can be found
 */
const getExtendedEnv = (): Record<string, string> => {
  const env = { ...process.env } as Record<string, string>
  const currentPath = env.PATH || ''

  // Add common tool locations to PATH if not already present
  const additionalPaths = [
    '/opt/homebrew/bin', // Homebrew on Apple Silicon
    '/usr/local/bin', // Homebrew on Intel
    '/usr/bin',
    '/bin',
  ]

  const pathParts = new Set(currentPath.split(':'))
  const missingPaths = additionalPaths.filter((p) => !pathParts.has(p))

  if (missingPaths.length > 0) {
    env.PATH = [...missingPaths, currentPath].filter(Boolean).join(':')
  }

  return env
}

/**
 * Default command options
 */
const defaultOptions: Required<CommandOptions> = {
  timeout: 60_000, // 60 seconds
  cwd: process.cwd(),
  env: getExtendedEnv(),
  retry: Schedule.once, // No retry by default
  throwOnError: true,
  verbose: false,
}

/**
 * Live Command Service Implementation
 */
export const CommandServiceLive = Layer.succeed(
  CommandService,
  CommandService.of({
    spawn: (command: readonly string[], options?: CommandOptions) => {
      const opts = { ...defaultOptions, ...options }
      const startTime = Date.now()

      return Effect.gen(function* () {
        if (opts.verbose) {
          yield* Effect.log(`Executing: ${command.join(' ')}`)
        }

        // Spawn process with Bun
        const proc = yield* Effect.try({
          try: () =>
            bunSpawn(command as string[], {
              cwd: opts.cwd,
              env: opts.env,
              stdout: 'pipe',
              stderr: 'pipe',
            }),
          catch: (error) =>
            new CommandSpawnError({
              command: command.join(' '),
              cause: error,
            }),
        })

        // Create effect for command execution
        const execEffect = Effect.tryPromise({
          try: async () => {
            const exitCode = await proc.exited
            const stdout = await new Response(proc.stdout).text()
            const stderr = await new Response(proc.stderr).text()
            const duration = Date.now() - startTime

            return { exitCode, stdout, stderr, duration }
          },
          catch: (error) =>
            new CommandSpawnError({
              command: command.join(' '),
              cause: error,
            }),
        })

        // Apply timeout
        const result = yield* Effect.timeout(execEffect, Duration.millis(opts.timeout)).pipe(
          Effect.catchTag('TimeoutException', () =>
            Effect.fail(
              new CommandTimeoutError({
                command: command.join(' '),
                timeoutMs: opts.timeout,
              })
            )
          )
        )

        // Check exit code
        if (opts.throwOnError && result.exitCode !== 0) {
          return yield* new CommandFailedError({
            command: command.join(' '),
            exitCode: result.exitCode,
            stderr: result.stderr,
            stdout: result.stdout,
          })
        }

        if (opts.verbose) {
          yield* Effect.log(`Command completed in ${result.duration}ms`)
        }

        return result
      }).pipe(Effect.retry(opts.retry))
    },

    exec: (command: string, options?: CommandOptions) => {
      const opts = { ...defaultOptions, ...options }

      return Effect.gen(function* () {
        if (opts.verbose) {
          yield* Effect.log(`Executing (sync): ${command}`)
        }

        const output = yield* Effect.try({
          try: () =>
            nodeExecSync(command, {
              cwd: opts.cwd,
              env: opts.env,
              encoding: 'utf-8',
              maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            }),
          catch: (error) => {
            const exitCode =
              error && typeof error === 'object' && 'status' in error ? (error.status as number) : 1
            const stderr =
              error && typeof error === 'object' && 'stderr' in error
                ? String(error.stderr)
                : String(error)
            const stdout =
              error && typeof error === 'object' && 'stdout' in error ? String(error.stdout) : ''

            return new CommandFailedError({
              command,
              exitCode,
              stderr,
              stdout,
            })
          },
        })

        if (opts.verbose) {
          yield* Effect.log('Command completed (sync)')
        }

        return output
      }).pipe(Effect.retry(opts.retry))
    },

    parallel: <E, R>(commands: readonly Effect.Effect<CommandResult, E, R>[]) =>
      Effect.all(commands, { concurrency: 'unbounded' }),

    withGitHubOutput: (name: string, command: readonly string[], options?: CommandOptions) => {
      const opts = { ...defaultOptions, ...options }
      const startTime = Date.now()

      return Effect.gen(function* () {
        // Spawn process
        const proc = yield* Effect.try({
          try: () =>
            bunSpawn(command as string[], {
              cwd: opts.cwd,
              env: opts.env,
              stdout: 'pipe',
              stderr: 'pipe',
            }),
          catch: (error) =>
            new CommandSpawnError({
              command: command.join(' '),
              cause: error,
            }),
        })

        // Create effect for command execution
        const execEffect = Effect.tryPromise({
          try: async () => {
            const exitCode = await proc.exited
            const stdout = await new Response(proc.stdout).text()
            const stderr = await new Response(proc.stderr).text()
            const duration = Date.now() - startTime

            return { exitCode, stdout, stderr, duration }
          },
          catch: (error) =>
            new CommandSpawnError({
              command: command.join(' '),
              cause: error,
            }),
        })

        // Apply timeout
        const result = yield* Effect.timeout(execEffect, Duration.millis(opts.timeout)).pipe(
          Effect.catchTag('TimeoutException', () =>
            Effect.fail(
              new CommandTimeoutError({
                command: command.join(' '),
                timeoutMs: opts.timeout,
              })
            )
          )
        )

        // Check exit code
        if (opts.throwOnError && result.exitCode !== 0) {
          return yield* new CommandFailedError({
            command: command.join(' '),
            exitCode: result.exitCode,
            stderr: result.stderr,
            stdout: result.stdout,
          })
        }

        // Write to GITHUB_OUTPUT if in GitHub Actions
        const githubOutput = process.env.GITHUB_OUTPUT
        if (githubOutput) {
          yield* Effect.tryPromise({
            try: async () => {
              const { appendFile } = await import('node:fs/promises')
              await appendFile(githubOutput, `${name}=${result.stdout}\n`)
            },
            catch: (error) =>
              new CommandFailedError({
                command: `write to GITHUB_OUTPUT`,
                exitCode: 1,
                stderr: String(error),
                stdout: '',
              }),
          })
        }

        return result
      }).pipe(Effect.retry(opts.retry))
    },
  })
)

/**
 * Helper functions for common operations
 */

/**
 * Spawn command with CommandService
 */
export const spawn = (command: readonly string[], options?: CommandOptions) =>
  CommandService.pipe(Effect.flatMap((service) => service.spawn(command, options)))

/**
 * Execute command (sync) with CommandService
 */
export const exec = (command: string, options?: CommandOptions) =>
  CommandService.pipe(Effect.flatMap((service) => service.exec(command, options)))

/**
 * Execute commands in parallel with CommandService
 */
export const parallel = <E, R>(commands: readonly Effect.Effect<CommandResult, E, R>[]) =>
  CommandService.pipe(Effect.flatMap((service) => service.parallel(commands)))

/**
 * Execute command with GitHub Actions output
 */
export const withGitHubOutput = (
  name: string,
  command: readonly string[],
  options?: CommandOptions
) =>
  CommandService.pipe(Effect.flatMap((service) => service.withGitHubOutput(name, command, options)))

/**
 * Common command builders
 */

/**
 * Run Bun test
 */
export const bunTest = (files: readonly string[], options?: CommandOptions) =>
  spawn(['bun', 'test', '--concurrent', ...files], {
    timeout: 30_000,
    ...options,
  })

/**
 * Run ESLint
 */
export const eslint = (files: readonly string[], options?: CommandOptions) =>
  spawn(
    [
      'bunx',
      'eslint',
      ...files,
      '--max-warnings',
      '0',
      '--cache',
      '--cache-location',
      'node_modules/.cache/eslint',
      '--cache-strategy',
      'content',
    ],
    {
      timeout: 120_000,
      ...options,
    }
  )

/**
 * Run TypeScript type check
 */
export const typecheck = (options?: CommandOptions) =>
  spawn(['bunx', 'tsc', '--noEmit', '--incremental'], {
    timeout: 60_000,
    ...options,
  })

/**
 * Run Playwright E2E tests
 */
export const playwrightTest = (grep?: string, options?: CommandOptions) => {
  const args = ['bunx', 'playwright', 'test']
  if (grep) {
    args.push('--grep', grep)
  }
  return spawn(args, {
    timeout: 120_000,
    ...options,
  })
}

/**
 * Run git command
 */
export const git = (args: readonly string[], options?: CommandOptions) =>
  spawn(['git', ...args], options)

/**
 * Run GitHub CLI command
 */
export const gh = (args: readonly string[], options?: CommandOptions) =>
  spawn(['gh', ...args], options)
