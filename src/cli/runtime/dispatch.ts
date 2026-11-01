/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineFlags, flag, parseFlags, type FlagsOf } from './flag-schema'
import { FLAG_VALUE_OPTIONS, NOUN_VERB_COMMANDS } from './flag-vocabulary'
import type { ParsedArgs } from './parsed-args'

/**
 * Sovrium CLI - Argument parsing and command dispatch
 *
 * Extracted from cli.ts to keep the main CLI file within line limits.
 */

const CONFIG_EXTENSIONS = [
  '.json',
  '.yaml',
  '.yml',
  '.ts',
  '.mts',
  '.JSON',
  '.YAML',
  '.YML',
  '.TS',
  '.MTS',
]

/**
 * Check if argument is a config file path (JSON, YAML, YML, or TypeScript)
 */
const isConfigFile = (arg: string | undefined): boolean =>
  arg !== undefined && (CONFIG_EXTENSIONS.some((ext) => arg.endsWith(ext)) || arg.includes('/'))

/**
 * Filter argv to only positional (non-flag) arguments
 */
const extractNonFlagArgs = (argv: readonly string[]): readonly string[] =>
  argv.filter(
    (arg, i) =>
      !arg.startsWith('-') &&
      (i === 0 || !FLAG_VALUE_OPTIONS.includes(argv[i - 1] as (typeof FLAG_VALUE_OPTIONS)[number]))
  )

/**
 * Detect early exit commands (--help, --version) before full parsing.
 *
 * `--help`/`-h` short-circuits ONLY when there is no positional command in
 * front of it — e.g. `sovrium --help`, `sovrium -h`. With a positional in
 * front (`sovrium admin --help`, `sovrium admin create --help`), the flag
 * survives so the subcommand's own handler can emit its specific help text.
 *
 * `--version`/`-v` always wins, regardless of position — there is no
 * subcommand-specific version output to defer to.
 */
const EARLY_EXIT_FLAGS = defineFlags({
  help: flag.switch('--help', '-h'),
  version: flag.switch('--version', '-v'),
})

const detectEarlyExit = (argv: readonly string[]): ParsedArgs | undefined => {
  const firstPositional = argv.find((arg) => !arg.startsWith('-'))
  const early = parseFlags(EARLY_EXIT_FLAGS, argv)
  if (early.help && firstPositional === undefined) {
    return {
      command: '--help',
      configFile: undefined,
      watchMode: false,
      forceFlag: false,
    }
  }
  if (early.version) {
    return {
      command: '--version',
      configFile: undefined,
      watchMode: false,
      forceFlag: false,
    }
  }
  return undefined
}

/**
 * The flags the dispatcher reads for every command, declared once.
 *
 * None of these affect positional-arg parsing — they are pass-through values
 * for the eventual `ParsedArgs` result. A flag only one verb reads belongs in
 * that verb's own schema (`withFlags` in `run-command.ts`), not here.
 */
const DISPATCH_FLAGS = defineFlags({
  watchMode: flag.switch('--watch', '-w'),
  forceFlag: flag.switch('--force'),
  helpRequested: flag.switch('--help', '-h'),
  outputPath: flag.value('--output'),
  templateName: flag.value('--template'),
  publicDirValue: flag.value('--publicDir'),
  noPublicDir: flag.switch('--no-publicDir'),
  appName: flag.value('--name'),
  // `--mode` is read by `sovrium seed` and `sovrium design-system`, each its own way.
  mode: flag.value('--mode'),
  dryRun: flag.switch('--dry-run'),
  check: flag.switch('--check'),
  json: flag.switch('--json'),
  format: flag.value('--format'),
})

type DispatchFlags = FlagsOf<typeof DISPATCH_FLAGS>

/**
 * Resolve `--publicDir <path>` / `--no-publicDir` into a single tri-state:
 * `false` opt-out wins over the explicit-value form when BOTH are passed (the
 * later "no" is a safer fallback than picking the first one), so an operator
 * who accidentally combines them still gets the disable behavior.
 */
const publicDirOf = (flags: DispatchFlags): string | false | undefined =>
  flags.noPublicDir ? false : flags.publicDirValue

/** Every dispatcher flag as `ParsedArgs` carries it. */
const flagArgsOf = (
  flags: DispatchFlags
): Omit<
  ParsedArgs,
  'command' | 'configFile' | 'subcommand' | 'positionalArg' | 'positionalArgs'
> => {
  const { publicDirValue: _value, noPublicDir: _none, ...rest } = flags
  return { ...rest, publicDir: publicDirOf(flags) }
}

/**
 * Build the standard noun-verb result (everything that isn't an early-exit
 * or implicit-config-file shortcut). Split out of `parseArgs` to keep it
 * under the per-function line cap.
 */
const buildStandardResult = (
  command: string,
  configFile: string | undefined,
  flags: DispatchFlags,
  nonFlagArgs: readonly string[]
): ParsedArgs => {
  // Noun-verb commands (admin/secret): 2nd positional is the verb,
  // 3rd is the verb's argument (admin email or secret scope).
  const isNounVerb = NOUN_VERB_COMMANDS.includes(command as (typeof NOUN_VERB_COMMANDS)[number])
  return {
    ...flagArgsOf(flags),
    command,
    configFile,
    subcommand: isNounVerb ? nonFlagArgs[1] : undefined,
    positionalArg: isNounVerb ? nonFlagArgs[2] : undefined,
    positionalArgs: nonFlagArgs.slice(1),
  }
}

/**
 * Parse CLI arguments into command, config file, and flags
 */
export const parseArgs = (argv: readonly string[]): ParsedArgs => {
  const earlyExit = detectEarlyExit(argv)
  if (earlyExit) return earlyExit

  const flags = parseFlags(DISPATCH_FLAGS, argv)
  const nonFlagArgs = extractNonFlagArgs(argv)
  const command = nonFlagArgs[0] || 'start'
  // For `admin create <email> [config]`, the optional config path is the 4th
  // positional (slots 1-2 are the verb + email). For all other commands the
  // config is the 2nd positional.
  const configFile = command === 'admin' ? nonFlagArgs[3] : nonFlagArgs[1]

  // Handle case where first arg is a config file (implicit 'start' command)
  if (isConfigFile(command)) {
    return {
      command: 'start',
      configFile: command,
      watchMode: flags.watchMode,
      outputPath: flags.outputPath,
      templateName: flags.templateName,
      appName: flags.appName,
      forceFlag: flags.forceFlag,
      publicDir: publicDirOf(flags),
      // Carried here too, not only in `buildStandardResult`: this branch is how
      // `sovrium app.yaml --help` parses, and without the flag the central
      // `--help` short-circuit in index.ts cannot see it — so asking for help
      // would boot a server instead.
      helpRequested: flags.helpRequested,
    }
  }

  return buildStandardResult(command, configFile, flags, nonFlagArgs)
}
