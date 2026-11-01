/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The CLI's command contract, and the ONE place a command's outcome becomes an
 * exit code.
 *
 * Every command is a {@link CommandHandler}: it reads the parsed command line
 * and returns an Effect that either succeeds or fails with a {@link CliStop}.
 * {@link runCommandProgram} runs it once, from `src/cli/index.ts`, and is the
 * only caller of `process.exit` on the command path:
 *
 * - success ends with 0 for a command that exits, and leaves a server command's
 *   process alive;
 * - a {@link CliRefusal} is printed in the failure shape and ends with its code;
 * - a {@link CliExit} prints its stderr line, if it carries one, and ends with its
 *   code — the stop for a message already printed, a raw `Error:` line, or a
 *   code propagated from a delegated tool;
 * - anything else is a crash: the `Unexpected failure` report and exit 1.
 *
 * ## Why a command written as plain async code can still stop
 *
 * Most commands are async functions, and a refusal several calls deep cannot
 * return a typed failure through every caller. {@link stopCommand} and
 * {@link refuseCommand} THROW the stop instead, and the runner reads it back
 * from either channel: a thrown stop arrives as a rejection, or as a defect when
 * it was thrown inside an Effect. A `catch` between the throw and the runner
 * must let it through — {@link rethrowCliStop} is that one line.
 */

import { Cause, Data, Effect, Exit } from 'effect'
import { printFailure, printStderr } from '@/infrastructure/logging/cli-output'
import { formatRuntimeError } from '@/infrastructure/logging/format-runtime-error'
import { parseFlags, type FlagSchema, type FlagsOf } from './flag-schema'
import type { ParsedArgs } from './parsed-args'

/**
 * A refusal printed in the failure shape: `headline` names the constraint and
 * what did not happen, `guidance` the next action. Exit 1 unless `exitCode`
 * says otherwise.
 */
export class CliRefusal extends Data.TaggedError('CliRefusal')<{
  readonly headline: string
  readonly guidance: string
  readonly detail?: readonly string[]
  readonly exitCode?: number
}> {}

/**
 * Stop with `code`, after writing `stderr` when there is one. None means the
 * command already printed what it had to say. (Not `message`: that is the
 * `Error` field, and would read as `""` when absent.)
 */
export class CliExit extends Data.TaggedError('CliExit')<{
  readonly code: number
  readonly stderr?: string
}> {}

/** How a command stops short of success. */
export type CliStop = CliRefusal | CliExit

/** What every command receives: the parsed flags, and the command line they came from. */
export interface CommandArgs extends ParsedArgs {
  readonly argv: readonly string[]
}

/** A command: the command line in, an outcome out. Only the runner turns it into an exit code. */
export type CommandHandler = (args: CommandArgs) => Effect.Effect<void, CliStop>

/** What a verb that declared its own flags receives: those flags, read and typed. */
export interface FlaggedArgs<S extends FlagSchema> extends CommandArgs {
  readonly flags: FlagsOf<S>
}

/**
 * A verb with its own flags: `schema` is read off the command line ONCE, as the
 * command is dispatched, and the verb receives the result as `args.flags`.
 */
export const withFlags =
  <S extends FlagSchema>(
    schema: S,
    run: (args: FlaggedArgs<S>) => Effect.Effect<void, CliStop>
  ): CommandHandler =>
  (args) =>
    run({ ...args, flags: parseFlags(schema, args.argv) })

/** Whether `value` is a command's stop rather than a failure nobody planned for. */
export const isCliStop = (value: unknown): value is CliStop =>
  value instanceof CliRefusal || value instanceof CliExit

/** A `catch` that must not swallow a stop calls this first. */
export const rethrowCliStop = (error: unknown): void => {
  if (isCliStop(error)) throw error
}

/** Stop the command from plain async code: write `message` to stderr, end with `code`. */
export const stopCommand = (code: number, message?: string): never => {
  throw new CliExit(message === undefined ? { code } : { code, stderr: message })
}

/** Refuse from plain async code, in the failure shape. */
export const refuseCommand = (refusal: ConstructorParameters<typeof CliRefusal>[0]): never => {
  throw new CliRefusal(refusal)
}

/** A rejection that was not a stop: it reaches the runner as a defect, the crash path. */
class Rejected extends Data.TaggedError('Rejected')<{ readonly cause: unknown }> {}

/** A stop thrown under a {@link tryCommandPromise}, on its way to become a defect. */
class StopInFlight extends Data.TaggedError('StopInFlight')<{ readonly stop: CliStop }> {}

/** Run a promise: a stop it throws is its typed failure, any other rejection a defect. */
const settle = <A>(run: () => Promise<A>): Effect.Effect<A, CliStop> =>
  Effect.tryPromise({
    try: run,
    catch: (cause): CliStop | Rejected => (isCliStop(cause) ? cause : new Rejected({ cause })),
  }).pipe(Effect.catchTag('Rejected', (rejected) => Effect.die(rejected.cause)))

/** Lift a command written as async code onto the contract; a thrown stop becomes its failure. */
export const fromAsync = (run: () => Promise<unknown>): Effect.Effect<void, CliStop> =>
  Effect.asVoid(settle(run))

/**
 * The value of an async step inside a command program: a stop it throws is the
 * program's failure, any other rejection the crash path — exactly as if the
 * whole command were written as async code.
 */
export const fromAsyncValue = <A>(run: () => Promise<A>): Effect.Effect<A, CliStop> => settle(run)

/**
 * `Effect.tryPromise` over code that may stop the command: a stop it throws
 * travels on as a defect the runner reads back unchanged, and only any other
 * failure becomes the `catch` error.
 */
export const tryCommandPromise = <A, E>(options: {
  readonly try: () => Promise<A>
  readonly catch: (cause: unknown) => E
}): Effect.Effect<A, E> =>
  Effect.tryPromise({
    try: options.try,
    catch: (cause) => (isCliStop(cause) ? new StopInFlight({ stop: cause }) : options.catch(cause)),
  }).pipe(
    Effect.catchIf(
      (error): error is StopInFlight => error instanceof StopInFlight,
      (inFlight) => Effect.die(inFlight.stop)
    )
  )

/** A verb with its own flags, written as an async function; see {@link withFlags}. */
export const withFlagsAsync = <S extends FlagSchema>(
  schema: S,
  run: (args: FlaggedArgs<S>) => Promise<unknown>
): CommandHandler => withFlags(schema, (args) => fromAsync(() => run(args)))

/** A command written as an async function; a stop it throws becomes its failure. */
export const asyncCommand =
  (run: (args: CommandArgs) => Promise<unknown>): CommandHandler =>
  (args) =>
    fromAsync(() => run(args))

/** A command written as an Effect program, in a module imported on first use. */
export const lazyProgram =
  <M>(
    load: () => Promise<M>,
    run: (module: M, args: CommandArgs) => Effect.Effect<void, CliStop>
  ): CommandHandler =>
  (args) =>
    Effect.flatMap(settle(load), (module) => run(module, args))

/** The exit a stop ends with, and what it writes on the way out. */
export const exitCodeOfStop = (stop: CliStop): number =>
  stop._tag === 'CliRefusal' ? (stop.exitCode ?? 1) : stop.code

const printStop = (stop: CliStop): void => {
  if (stop._tag === 'CliExit') {
    if (stop.stderr !== undefined) printStderr(stop.stderr)
    return
  }
  const { headline, guidance, detail } = stop
  printFailure({ headline, guidance, ...(detail === undefined ? {} : { detail }) })
}

/**
 * The crash path: a failure Sovrium has no specific handling for.
 *
 * `formatRuntimeError` unwraps Effect failures, causes and parse errors into
 * something actionable — without it most of them surface as "An error has
 * occurred". The headline is a CRASH marker and nothing else: a refused config
 * never arrives here, it is a {@link CliStop}.
 */
const reportCrash = async (command: string, error: unknown): Promise<never> => {
  const message = formatRuntimeError(error)
  const { offerFailureReport, withoutSecretValues } = await import('./failure-report')
  printFailure({
    headline: 'Unexpected failure — Sovrium changed nothing.',
    detail: [withoutSecretValues(message)],
    guidance: offerFailureReport({ command, error, text: message }),
  })
  return process.exit(1)
}

/**
 * Run one command program and end the process the way its outcome says.
 *
 * `exitOnSuccess` is false for a command that may keep the process alive — a
 * server — whose success is that it is still running.
 */
export const runCommandProgram = async (
  program: Effect.Effect<void, CliStop>,
  options: { readonly command: string; readonly exitOnSuccess: boolean }
): Promise<void> => {
  const exit = await Effect.runPromiseExit(program)
  if (Exit.isSuccess(exit)) {
    if (options.exitOnSuccess) process.exit(0)
    return
  }
  const failure = Cause.squash(exit.cause)
  if (!isCliStop(failure)) return reportCrash(options.command, failure)
  printStop(failure)
  process.exit(exitCodeOfStop(failure))
}
