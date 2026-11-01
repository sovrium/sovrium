/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What one invocation of the CLI runs, decided before anything runs: the
 * harness's stylesheet seam, an unknown flag, `<command> --help`, a command
 * from one of the two dispatch tables in `src/cli/index.ts`, or an unknown
 * command. `run-command.ts` then turns the outcome into the exit code.
 */

import { Effect } from 'effect'
import { renderLine } from '@/infrastructure/logging/cli-output'
import { getCommandHelp } from './command-help'
import { failIfCrashInjected } from './fault-injection'
import { findUnknownFlag } from './flag-vocabulary'
import {
  CliRefusal,
  fromAsync,
  lazyProgram,
  type CliStop,
  type CommandHandler,
} from './run-command'
import type { ParsedArgs } from './parsed-args'

/** What this invocation runs, and whether its success ends the process. */
export interface Invocation {
  readonly program: Effect.Effect<void, CliStop>
  readonly exitOnSuccess: boolean
}

/** The command line, parsed, and the two dispatch tables it is read against. */
export interface InvocationInput {
  readonly parsed: ParsedArgs
  readonly argv: readonly string[]
  /** Commands that end the process once they return. */
  readonly exitCommands: Readonly<Record<string, CommandHandler>>
  /** Commands that may keep it alive: a server. */
  readonly persistentCommands: Readonly<Record<string, CommandHandler>>
}

const exitWith = (program: Effect.Effect<void, CliStop>): Invocation => ({
  program,
  exitOnSuccess: true,
})

/**
 * Answer `<command> --help`, BEFORE either dispatch table runs.
 *
 * If `--help` were opt-in per command, a command that forgot to opt in would
 * simply run — `schema --help` dumping the whole JSON Schema, `stop --help`
 * stopping a live server, `init --help` scaffolding a project into the working
 * directory and overwriting an existing `CLAUDE.md`. Asking a command what its
 * options are must never be the thing that runs it.
 *
 * Centralising the lookup (rather than threading a flag into each handler) is
 * what makes the behaviour hold for commands not yet written: a new command
 * inherits `--help` by appearing in `COMMAND_HELP`.
 */
const requestedCommandHelp = (parsed: ParsedArgs): string | undefined =>
  parsed.helpRequested === true ? getCommandHelp(parsed.command, parsed.subcommand) : undefined

/**
 * Reject unknown flags BEFORE dispatching — otherwise `--definitely-not-a-flag`
 * silently falls through to implicit `start` and the user gets a misleading
 * "No configuration provided" message instead of "Unknown flag: --foo".
 * Skipped when `--help` / `--version` short-circuits (early exit already accepted).
 */
const unknownFlagRefusal = (
  parsed: ParsedArgs,
  argv: readonly string[]
): CliRefusal | undefined => {
  if (parsed.command === '--help' || parsed.command === '--version') return undefined
  const unknownFlag = findUnknownFlag(argv)
  if (unknownFlag === undefined) return undefined
  // `import` refuses a token on the command line itself, naming the variable to use.
  if (parsed.command === 'import' && /^--token(?:=|$)/.test(unknownFlag)) return undefined
  return new CliRefusal({
    headline: `Unknown flag "${unknownFlag}".`,
    guidance: "Run 'sovrium --help' to list the accepted flags.",
  })
}

/** Decide what this invocation runs. Runs nothing itself. */
export const resolveInvocation = (input: InvocationInput): Invocation => {
  const { parsed, argv } = input
  const args = { ...parsed, argv }

  // The E2E harness's generic-stylesheet seam, ahead of everything else: it
  // ignores the command line. Not a capability — see the module's docblock.
  const genericCssPath = process.env['SOVRIUM_E2E_PRECOMPILE_CSS']
  if (genericCssPath) {
    return exitWith(
      lazyProgram(
        () => import('./precompile-generic-css'),
        (module) => module.precompileGenericCss(genericCssPath)
      )(args)
    )
  }

  const unknownFlag = unknownFlagRefusal(parsed, argv)
  if (unknownFlag !== undefined) return exitWith(Effect.fail(unknownFlag))

  // Answered ahead of BOTH dispatch tables — see `requestedCommandHelp`.
  const commandHelp = requestedCommandHelp(parsed)
  if (commandHelp !== undefined) return exitWith(renderLine(commandHelp))

  // The non-production `SOVRIUM_FAULT_INJECTION=crash` seam: a failure before
  // the named command runs, which only the crash report catches.
  const crashIfInjected = fromAsync(() => failIfCrashInjected(parsed.command))
  const exitHandler = input.exitCommands[parsed.command]
  const handler = exitHandler ?? input.persistentCommands[parsed.command]
  if (handler !== undefined) {
    return {
      program: Effect.andThen(crashIfInjected, handler(args)),
      exitOnSuccess: exitHandler !== undefined,
    }
  }

  // Unknown command. It does not fall through to an implicit `start`: with
  // config auto-discovery, in a directory holding an `app.yaml`, `sovrium strt`
  // would silently BOOT A SERVER. So an unknown word is reported as a typo,
  // exactly as an unknown *flag* already is above.
  //
  // Still reaching their handlers, and not this branch: bare `sovrium` (parseArgs
  // defaults the command to `start`) and `sovrium ./app.yaml` (isConfigFile
  // rewrites it to `start` with a configFile).
  return exitWith(
    Effect.andThen(
      crashIfInjected,
      Effect.fail(
        new CliRefusal({
          headline: `Unknown command "${parsed.command}".`,
          guidance: "Run 'sovrium --help' to list the available commands.",
        })
      )
    )
  )
}
