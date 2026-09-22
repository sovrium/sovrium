/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ONE place in `scripts/` that starts a child process (SC2).
 *
 * Three defects this module used to carry, all of them silent, all of them
 * fixed here — recorded because each one is easy to reintroduce by writing the
 * "obvious" version:
 *
 *   1. **A timed-out child leaked.** `Effect.timeout` abandoned the Effect but
 *      nothing ever signalled the process, so the orphan kept running, kept
 *      holding its port, and kept its share of the machine. That is the root
 * cause `[internal ref]` exists to clean up after. The
 *      child is now acquired with {@link Effect.acquireRelease}, so a timeout,
 *      an interrupt, and an ordinary failure all run the same terminator.
 *   2. **A child writing more than a pipe buffer deadlocked.** stdout and
 *      stderr were read only AFTER `proc.exited` resolved — but a child cannot
 *      exit while blocked writing into a full pipe, and the pipe cannot drain
 *      while nobody reads it. Roughly 64 KB of output was all it took. Both
 *      streams are now read CONCURRENTLY with `exited`.
 *   3. **`exec` ignored its own timeout.** It was `node:child_process.execSync`,
 *      which blocks the whole Bun event loop and accepts no deadline from this
 *      service at all. It is now the same async argv spawn as everything else.
 */

import { appendFile } from 'node:fs/promises'
import { spawn as bunSpawn } from 'bun'
import * as Context from 'effect/Context'
import * as Data from 'effect/Data'
import * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Schedule from 'effect/Schedule'
import type { Subprocess } from 'bun'
import type * as Scope from 'effect/Scope'

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

/** Every way a command can fail. */
export type CommandError = CommandFailedError | CommandTimeoutError | CommandSpawnError

/**
 * Command execution result
 */
export interface CommandResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
  readonly duration: number
  /**
   * The signal that killed the child, when one did, else `null`.
   *
   * `exitCode` alone does not say WHY. Measured on Bun 1.4.1: a child killed by
   * SIGTERM leaves `proc.exitCode` at `null` while `proc.exited` resolves to
   * **143** — Bun applies the shell's 128+signum convention itself, so the
   * numeric code is already correct and needs no mapping. What the number
   * cannot tell a reader is that 143 means "interrupted" rather than "the tool
   * chose to exit 143", and a wrapper that reports the former as an ordinary
   * failure sends someone hunting a test bug that does not exist. This field is
   * what lets the wrapper say which it was.
   */
  readonly signal: string | null
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
  /**
   * Run the command through `/bin/sh -c` instead of spawning its argv
   * (default: false — see {@link tokenizeCommand} for why this is opt-in).
   */
  readonly shell?: boolean
  /**
   * How long a child gets between SIGTERM and SIGKILL (default: 2000ms).
   *
   * Two seconds, not two hundred milliseconds: the children this service runs
   * are quality gates, and several of them (ESLint, `tsc`) are mid-write to a
   * cache file when the signal lands. A grace short enough to SIGKILL a
   * still-writing cache trades a leaked process for a corrupt one, which is
   * the worse of the two and much harder to diagnose.
   */
  readonly killGraceMs?: number
  /**
   * Attach the child to THIS process's terminal instead of capturing it
   * (default: false — the captured form is what a gate wants).
   *
   * The captured form buffers everything until exit, which is correct for a
   * gate whose output is a verdict and wrong for a child whose output IS the
   * user experience: a thirty-minute Playwright sweep that prints nothing until
   * it finishes is indistinguishable from a hang. Inheriting also puts the
   * child in this process's foreground group, so a terminal `^C` reaches it
   * directly rather than only through the release below.
   *
   * The trade is explicit: with `inherit`, `stdout` and `stderr` on the result
   * are EMPTY, because nobody read them. A caller that needs both the live
   * stream and the text has to choose, and this service refuses to pretend
   * otherwise.
   */
  readonly inherit?: boolean
}

/**
 * Command Service Interface
 */
export interface CommandService {
  /**
   * Execute a command as argv (async, non-blocking).
   * @param command - Command as array (e.g., ['bun', 'test', 'file.ts'])
   * @param options - Execution options
   * @returns Effect that resolves to CommandResult
   */
  readonly spawn: (
    command: readonly string[],
    options?: CommandOptions
  ) => Effect.Effect<CommandResult, CommandError>

  /**
   * Execute a command written as a single string, returning its stdout.
   *
   * The string is SPLIT INTO ARGV and spawned directly. Pass `shell: true` to
   * run it through `/bin/sh -c` instead; a string carrying shell syntax
   * without that flag is rejected rather than guessed at.
   *
   * @param command - Command as string (e.g., 'git status')
   * @param options - Execution options
   * @returns Effect that resolves to the command's stdout
   */
  readonly exec: (command: string, options?: CommandOptions) => Effect.Effect<string, CommandError>

  /**
   * Start a LONG-LIVED child and hand back the live process, bound to the
   * enclosing scope.
   *
   * {@link spawn} is the wrong shape for a server: its contract is "run to
   * completion", so it waits on `exited` — which for a process whose whole
   * purpose is not to exit means waiting for the timeout, every time. Two
   * harnesses (`design-review.ts`, `measure-load.ts`) boot a Sovrium server and
   * then talk to it over HTTP, and before this existed they were the one
   * sanctioned reason left in `scripts/` to reach for `node:child_process`
   * directly — which is to say, the one place SC2 could not actually be
   * enforced.
   *
   * The scope is the whole guarantee: the release half sends SIGTERM and then
   * SIGKILL after the grace, so a failure, a deadline and an operator's `^C`
   * all reap the server. A hand-rolled `try/finally` around a boot does not
   * cover the interrupt, and a leaked server holds its port until someone
   * notices the next run cannot bind.
   *
   * Streams are INHERITED unless `inherit: false` — a booted server's log is
   * usually what the operator is reading, and nobody is draining its pipes.
   */
  readonly start: (
    command: readonly string[],
    options?: CommandOptions
  ) => Effect.Effect<Subprocess, CommandSpawnError, Scope.Scope>

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
  ) => Effect.Effect<CommandResult, CommandError>
}

/**
 * Command Service Tag (for dependency injection)
 */
export const CommandService = Context.Service<CommandService>('CommandService')

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
 * The default retry schedule: exactly ONE attempt, no retry.
 *
 * Exported so `CommandService.test.ts` can assert the attempt COUNT rather
 * than the spelling. `Schedule.recurs(1)` and `Schedule.recurs(0)` differ by
 * one character and by a factor of two in attempts, and the only reason the
 * previous contradiction survived this long is that nothing ever counted.
 */
export const DEFAULT_RETRY_SCHEDULE: Schedule.Schedule<unknown, unknown, never> = Schedule.recurs(0)

/** Default grace between SIGTERM and SIGKILL. See {@link CommandOptions.killGraceMs}. */
export const DEFAULT_KILL_GRACE_MS = 2000

/**
 * Default command options
 */
const defaultOptions: Required<CommandOptions> = {
  timeout: 60_000, // 60 seconds
  cwd: process.cwd(),
  env: getExtendedEnv(),
  // NO retry, and now actually none. This read `Schedule.recurs(1)` — one
  // retry, two attempts (measured; `recurs(N)` means N RETRIES, so `recurs(0)`
  // is the identity and `recurs(1)` already doubles). The comment beside it,
  // and the `CommandOptions.retry` doc above, both said "no retry"; the code
  // said otherwise, and no caller has ever passed a `retry` to override it.
  //
  // Resolved toward the DOCUMENTED intent rather than the observed behaviour,
  // for three reasons:
  //
  //   1. Everything that runs through this service is part of a QUALITY GATE.
  //      A command that fails once and passes on the retry is exactly the
  //      signal worth seeing — registry flakiness, a contended runner, a
  //      racing lock. Silently absorbing it converts a diagnosis into a
  //      slightly slower green.
  //   2. A retry is only ever safe for an IDEMPOTENT command, and nothing here
  //      enforces that. A hidden default that re-runs whatever the next caller
  //      happens to add is a trap; the current sole caller (`bun audit`) is
  //      read-only, but that is a property of today's caller, not of the API.
  //   3. Two attempts against a 60s timeout is a 120s worst case, paid by
  //      every command, to no declared end.
  //
  // If a specific command genuinely needs tolerance, pass `retry:` AT THAT CALL
  // SITE with the reason written down, where it is visible and bounded.
  retry: DEFAULT_RETRY_SCHEDULE,
  throwOnError: true,
  verbose: false,
  shell: false,
  killGraceMs: DEFAULT_KILL_GRACE_MS,
  inherit: false,
}

// ─── Process lifecycle ────────────────────────────────────────────────────────

/** Sentinel for "the grace period elapsed", distinguishable from any exit code. */
const GRACE_ELAPSED = Symbol('grace-elapsed')

/**
 * Stop a child that is still running: SIGTERM, a grace period, then SIGKILL.
 *
 * Run as the RELEASE half of {@link Effect.acquireRelease}, so it fires on
 * every exit path — success (where it is a no-op, the child having already
 * been reaped), failure, timeout, and fiber interrupt. Before this existed, a
 * timed-out gate left its child running for the rest of the session.
 */
const terminate = (proc: Subprocess, graceMs: number): Effect.Effect<void> =>
  // Every call that could throw is wrapped, and the thunk resolves to void on
  // every branch. A release that can FAIL would mask the very failure it is
  // cleaning up after, so totality is the contract here rather than a
  // convenience.
  // effect-promise: total -- every throwing call is wrapped; resolves to void on every branch
  Effect.promise(async () => {
    // Already reaped: `exited` has resolved, or a signal already landed.
    if (proc.exitCode !== null || proc.signalCode !== null) return

    try {
      proc.kill('SIGTERM')
    } catch {
      // The child raced us to its own exit. Nothing left to signal.
      return
    }

    const outcome = await Promise.race([
      proc.exited,
      Bun.sleep(graceMs).then(() => GRACE_ELAPSED),
    ]).catch(() => GRACE_ELAPSED)

    if (outcome !== GRACE_ELAPSED) return

    try {
      proc.kill('SIGKILL')
    } catch {
      return
    }
    await proc.exited.catch(() => undefined)
  })

/** Acquire a child bound to the enclosing scope; its release terminates it. */
const acquireChild = (argv: readonly string[], display: string, opts: Required<CommandOptions>) =>
  Effect.acquireRelease(
    Effect.try({
      try: () =>
        opts.inherit
          ? bunSpawn([...argv], {
              cwd: opts.cwd,
              env: opts.env,
              stdin: 'inherit',
              stdout: 'inherit',
              stderr: 'inherit',
            })
          : bunSpawn([...argv], {
              cwd: opts.cwd,
              env: opts.env,
              stdout: 'pipe',
              stderr: 'pipe',
            }),
      catch: (error) => new CommandSpawnError({ command: display, cause: error }),
    }),
    (proc) => terminate(proc, opts.killGraceMs)
  )

/**
 * Drain both streams WHILE waiting for the exit.
 *
 * The `Promise.all` is the whole point: awaiting `proc.exited` first deadlocks
 * any child that writes more than a pipe buffer (~64 KB), because the child
 * blocks on the write and the buffer only drains when someone reads it.
 */
/**
 * Whether a child's stream is something to drain.
 *
 * Under `inherit` it is not: the streams belong to this process's terminal, so
 * there is nothing to read, and the pipe-buffer deadlock {@link collectOutput}
 * guards against cannot occur because the child writes straight to the tty.
 */
const isReadable = (stream: unknown): stream is ReadableStream<Uint8Array> =>
  stream instanceof ReadableStream

const collectOutput = (
  proc: Subprocess,
  display: string,
  startedAt: number
): Effect.Effect<CommandResult, CommandSpawnError> =>
  Effect.tryPromise({
    try: async () => {
      const [stdout, stderr, exitCode] = await Promise.all([
        isReadable(proc.stdout) ? new Response(proc.stdout).text() : Promise.resolve(''),
        isReadable(proc.stderr) ? new Response(proc.stderr).text() : Promise.resolve(''),
        proc.exited,
      ])
      return {
        exitCode,
        stdout,
        stderr,
        duration: Date.now() - startedAt,
        signal: proc.signalCode,
      }
    },
    catch: (error) => new CommandSpawnError({ command: display, cause: error }),
  })

/**
 * The single command runner. `spawn`, `exec` and `withGitHubOutput` are all
 * this function plus a thin shim — they were 95 % duplicated before, which is
 * how `withGitHubOutput` came to be the copy that never got the timeout fix.
 */
const runCommand = (
  argv: readonly string[],
  display: string,
  options?: CommandOptions
): Effect.Effect<CommandResult, CommandError> => {
  const opts = { ...defaultOptions, ...options }

  return Effect.scoped(
    Effect.gen(function* () {
      if (opts.verbose) {
        yield* Effect.log(`Executing: ${display}`)
      }
      const startedAt = Date.now()
      const proc = yield* acquireChild(argv, display, opts)
      return yield* collectOutput(proc, display, startedAt)
    })
  ).pipe(
    // The scope is INSIDE the timeout on purpose: a timeout interrupts the
    // fiber, interruption closes the scope, and closing the scope terminates
    // the child. Putting the timeout inside would abandon the process again.
    Effect.timeout(Duration.millis(opts.timeout)),
    Effect.catchTag('TimeoutError', () =>
      Effect.fail(new CommandTimeoutError({ command: display, timeoutMs: opts.timeout }))
    ),
    Effect.flatMap((result) =>
      opts.throwOnError && result.exitCode !== 0
        ? Effect.fail(
            new CommandFailedError({
              command: display,
              exitCode: result.exitCode,
              stderr: result.stderr,
              stdout: result.stdout,
            })
          )
        : Effect.succeed(result)
    ),
    Effect.tap((result) =>
      opts.verbose ? Effect.log(`Command completed in ${result.duration}ms`) : Effect.void
    ),
    Effect.retry(opts.retry)
  )
}

/** Shell syntax a bare `exec` string must not carry. */
const SHELL_METACHARACTERS = /[|&;<>()$`\\"'*?[\]{}~\n]/

/**
 * Split a command string into argv, refusing anything that needs a shell.
 *
 * `exec` takes a string for caller convenience, and a string is ambiguous:
 * `git fetch a:b 2>/dev/null || true` cannot be spawned as argv, and
 * `git branch --list "origin/main"` means something different once the quotes
 * become literal characters. Guessing is how a quoted argument silently turns
 * into two, so the ambiguous case is REFUSED and the caller either passes
 * `shell: true` (accepting the shell) or calls `spawn` with real argv.
 */
const tokenizeCommand = (
  command: string,
  display: string
): Effect.Effect<readonly string[], CommandSpawnError> => {
  if (SHELL_METACHARACTERS.test(command)) {
    return Effect.fail(
      new CommandSpawnError({
        command: display,
        cause: new Error(
          'the command string carries shell syntax. Pass `shell: true` to run it through ' +
            '/bin/sh, or call `spawn` with an argv array. It is NOT tokenized by guesswork.'
        ),
      })
    )
  }
  const argv = command
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
  return argv.length === 0
    ? Effect.fail(
        new CommandSpawnError({ command: display, cause: new Error('empty command string') })
      )
    : Effect.succeed(argv)
}

/**
 * Live Command Service Implementation
 */
export const CommandServiceLive = Layer.succeed(
  CommandService,
  CommandService.of({
    spawn: (command: readonly string[], options?: CommandOptions) =>
      runCommand(command, command.join(' '), options),

    exec: (command: string, options?: CommandOptions) =>
      (options?.shell === true
        ? Effect.succeed(['/bin/sh', '-c', command] as readonly string[])
        : tokenizeCommand(command, command)
      ).pipe(
        Effect.flatMap((argv) => runCommand(argv, command, options)),
        Effect.map((result) => result.stdout)
      ),

    start: (command: readonly string[], options?: CommandOptions) =>
      acquireChild(command, command.join(' '), {
        ...defaultOptions,
        // A long-lived child's streams belong to the operator's terminal by
        // default: nothing here drains a pipe, and an undrained pipe is the
        // 64 KB deadlock this module's header records.
        inherit: options?.inherit ?? true,
        ...options,
      }),

    parallel: <E, R>(commands: readonly Effect.Effect<CommandResult, E, R>[]) =>
      Effect.all(commands, { concurrency: 'unbounded' }),

    withGitHubOutput: (name: string, command: readonly string[], options?: CommandOptions) =>
      runCommand(command, command.join(' '), options).pipe(
        Effect.tap((result) => {
          const githubOutput = process.env.GITHUB_OUTPUT
          return githubOutput === undefined || githubOutput === ''
            ? Effect.void
            : Effect.tryPromise({
                try: () => appendFile(githubOutput, `${name}=${result.stdout}\n`),
                catch: (error) =>
                  new CommandFailedError({
                    command: `write to GITHUB_OUTPUT`,
                    exitCode: 1,
                    stderr: String(error),
                    stdout: '',
                  }),
              })
        })
      ),
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
 * Execute command (string form) with CommandService
 * @public
 */
export const exec = (command: string, options?: CommandOptions) =>
  CommandService.pipe(Effect.flatMap((service) => service.exec(command, options)))

/**
 * Execute commands in parallel with CommandService
 * @public
 */
export const parallel = <E, R>(commands: readonly Effect.Effect<CommandResult, E, R>[]) =>
  CommandService.pipe(Effect.flatMap((service) => service.parallel(commands)))

/**
 * Start a long-lived child bound to the enclosing scope.
 * @see CommandService.start
 */
export const start = (command: readonly string[], options?: CommandOptions) =>
  CommandService.pipe(Effect.flatMap((service) => service.start(command, options)))

/**
 * Common command builders
 */

/**
 * Run Bun test
 * @public
 */
export const bunTest = (files: readonly string[], options?: CommandOptions) =>
  spawn(['bun', 'test', '--concurrent', ...files], {
    timeout: 30_000,
    ...options,
  })

/**
 * Run ESLint
 * @public
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
 * @public
 */
export const typecheck = (options?: CommandOptions) =>
  // Addressed by path, not as `tsc`: node_modules/.bin/tsc is TypeScript 7
  // (tsgo's compiler, installed under the `@typescript/native` alias). See
  // `TSC_BIN` in [internal ref].
  spawn(['./node_modules/typescript/bin/tsc', '--noEmit', '--incremental'], {
    timeout: 60_000,
    ...options,
  })

/**
 * Run Playwright E2E tests
 * @public
 */
export const playwrightTest = (grep?: string, options?: CommandOptions) => {
  // `bun --bun <cli>`, not `bunx playwright`: node_modules/.bin/playwright
  // symlinks to a file whose shebang is `#!/usr/bin/env node`, so bunx hands the
  // run to Node. § "Decision reversal (2026-09-05)".
  const args = [process.execPath, '--bun', './node_modules/.bin/playwright', 'test']
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
 * @public
 */
export const git = (args: readonly string[], options?: CommandOptions) =>
  spawn(['git', ...args], options)

/**
 * Run GitHub CLI command
 * @public
 */
export const gh = (args: readonly string[], options?: CommandOptions) =>
  spawn(['gh', ...args], options)
