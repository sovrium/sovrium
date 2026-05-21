/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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

export interface CommandResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
  readonly duration: number
}

export interface CommandOptions {
  readonly timeout?: number
  readonly cwd?: string
  readonly env?: Record<string, string>
  readonly retry?: Schedule.Schedule<unknown, unknown, never>
  readonly throwOnError?: boolean
  readonly verbose?: boolean
}

export interface CommandService {
  readonly spawn: (
    command: readonly string[],
    options?: CommandOptions
  ) => Effect.Effect<CommandResult, CommandFailedError | CommandTimeoutError | CommandSpawnError>

  readonly exec: (
    command: string,
    options?: CommandOptions
  ) => Effect.Effect<string, CommandFailedError>

  readonly parallel: <E, R>(
    commands: readonly Effect.Effect<CommandResult, E, R>[]
  ) => Effect.Effect<readonly CommandResult[], E, R>

  readonly withGitHubOutput: (
    name: string,
    command: readonly string[],
    options?: CommandOptions
  ) => Effect.Effect<CommandResult, CommandFailedError | CommandTimeoutError | CommandSpawnError>
}

export const CommandService = Context.GenericTag<CommandService>('CommandService')

const getExtendedEnv = (): Record<string, string> => {
  const env = { ...process.env } as Record<string, string>
  const currentPath = env.PATH || ''

  const additionalPaths = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
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

const defaultOptions: Required<CommandOptions> = {
  timeout: 60_000,
  cwd: process.cwd(),
  env: getExtendedEnv(),
  retry: Schedule.once,
  throwOnError: true,
  verbose: false,
}

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
              maxBuffer: 10 * 1024 * 1024,
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

        if (opts.throwOnError && result.exitCode !== 0) {
          return yield* new CommandFailedError({
            command: command.join(' '),
            exitCode: result.exitCode,
            stderr: result.stderr,
            stdout: result.stdout,
          })
        }

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


export const spawn = (command: readonly string[], options?: CommandOptions) =>
  CommandService.pipe(Effect.flatMap((service) => service.spawn(command, options)))

export const exec = (command: string, options?: CommandOptions) =>
  CommandService.pipe(Effect.flatMap((service) => service.exec(command, options)))

export const parallel = <E, R>(commands: readonly Effect.Effect<CommandResult, E, R>[]) =>
  CommandService.pipe(Effect.flatMap((service) => service.parallel(commands)))

export const withGitHubOutput = (
  name: string,
  command: readonly string[],
  options?: CommandOptions
) =>
  CommandService.pipe(Effect.flatMap((service) => service.withGitHubOutput(name, command, options)))


export const bunTest = (files: readonly string[], options?: CommandOptions) =>
  spawn(['bun', 'test', '--concurrent', ...files], {
    timeout: 30_000,
    ...options,
  })

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

export const typecheck = (options?: CommandOptions) =>
  spawn(['bunx', 'tsc', '--noEmit', '--incremental'], {
    timeout: 60_000,
    ...options,
  })

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

export const git = (args: readonly string[], options?: CommandOptions) =>
  spawn(['git', ...args], options)

export const gh = (args: readonly string[], options?: CommandOptions) =>
  spawn(['gh', ...args], options)
