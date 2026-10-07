/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  FLAG_VALUE_OPTIONS,
  NOUN_VERB_COMMANDS,
  getFlagPathValue,
  getFlagValue,
  getFlagValues,
  hasFlag,
} from './flag-vocabulary'
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
const detectEarlyExit = (argv: readonly string[]): ParsedArgs | undefined => {
  const firstPositional = argv.find((arg) => !arg.startsWith('-'))
  if (hasFlag(argv, '--help', '-h') && firstPositional === undefined) {
    return {
      command: '--help',
      configFile: undefined,
      watchMode: false,
      forceFlag: false,
    }
  }
  if (hasFlag(argv, '--version', '-v')) {
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
 * Bundle of every parsed flag value, extracted so `parseArgs` stays under the
 * per-function statement cap. None of these affect positional-arg parsing —
 * they are pass-through values for the eventual `ParsedArgs` result.
 */
interface ParsedFlags {
  readonly watchMode: boolean
  readonly forceFlag: boolean
  readonly outputPath: string | undefined
  readonly dataDir: string | undefined
  readonly templateName: string | undefined
  /**
   * `string`    — explicit `--publicDir <path>`.
   * `false`     — explicit `--no-publicDir` (opt-out).
   * `undefined` — neither flag present; caller falls back to env / default.
   */
  readonly publicDir: string | false | undefined
  readonly appName: string | undefined
  readonly typescript: boolean
  readonly gitInit: boolean
  readonly fromUrl: string | undefined
  readonly password: string | undefined
  readonly seedDir: string | undefined
  readonly seedMode: string | undefined
  readonly seedTables: readonly string[]
  readonly seedAs: string | undefined
  readonly seedToday: string | undefined
  readonly dryRun: boolean
  readonly check: boolean
  readonly allowDestructive: boolean
  readonly json: boolean
  readonly format: string | undefined
  readonly full: boolean
  readonly listSections: boolean
  readonly lang: string | undefined
  readonly docsSections: readonly string[]
  readonly exportRequested: boolean
  readonly exportDir: string | undefined
  readonly projectDir: string | undefined
  readonly libraryKind: string | undefined
  readonly libraryCategory: string | undefined
  readonly librarySets: readonly string[]
  readonly libraryAs: string | undefined
  readonly libraryInto: string | undefined
  readonly noWire: boolean
  readonly libraryTag: string | undefined
  readonly libraryLimit: string | undefined
  readonly libraryAll: boolean
  readonly libraryYes: boolean
  readonly skillsTarget: string | undefined
}

/**
 * Resolve `--publicDir <path>` / `--no-publicDir` into a single tri-state:
 * `false` opt-out wins over the explicit-value form when BOTH are passed (the
 * later "no" is a safer fallback than picking the first one), so an operator
 * who accidentally combines them still gets the disable behavior.
 */
const resolvePublicDirFlag = (argv: readonly string[]): string | false | undefined => {
  if (argv.includes('--no-publicDir')) return false
  return getFlagValue(argv, '--publicDir')
}

/** The `sovrium library` flags that choose API operations and bound a search. */
const parseLibraryOperationFlags = (
  argv: readonly string[]
): Pick<ParsedFlags, 'libraryTag' | 'libraryLimit' | 'libraryAll' | 'libraryYes'> => ({
  libraryTag: getFlagValue(argv, '--tag'),
  libraryLimit: getFlagValue(argv, '--limit'),
  libraryAll: argv.includes('--all'),
  libraryYes: argv.includes('--yes'),
})

/** The flags only `sovrium seed` reads (`--as` is shared with `library add`). */
const parseSeedFlags = (
  argv: readonly string[]
): Pick<ParsedFlags, 'seedDir' | 'seedMode' | 'seedTables' | 'seedAs' | 'seedToday'> => ({
  seedDir: getFlagValue(argv, '--dir'),
  seedMode: getFlagValue(argv, '--mode'),
  seedTables: getFlagValues(argv, '--table'),
  seedAs: getFlagValue(argv, '--as'),
  seedToday: getFlagValue(argv, '--today'),
})

const parseAllFlags = (argv: readonly string[]): ParsedFlags => ({
  watchMode: hasFlag(argv, '--watch', '-w'),
  forceFlag: argv.includes('--force'),
  outputPath: getFlagValue(argv, '--output'),
  dataDir: getFlagPathValue(argv, '--data-dir'),
  templateName: getFlagValue(argv, '--template'),
  publicDir: resolvePublicDirFlag(argv),
  appName: getFlagValue(argv, '--name'),
  typescript: argv.includes('--typescript'),
  gitInit: argv.includes('--git'),
  fromUrl: getFlagValue(argv, '--from-url'),
  password: getFlagValue(argv, '--password'),
  ...parseSeedFlags(argv),
  dryRun: argv.includes('--dry-run'),
  check: argv.includes('--check'),
  allowDestructive: argv.includes('--allow-destructive'),
  json: argv.includes('--json'),
  format: getFlagValue(argv, '--format'),
  full: argv.includes('--full'),
  listSections: argv.includes('--list-sections'),
  lang: getFlagValue(argv, '--lang'),
  docsSections: getFlagValues(argv, '--section'),
  exportRequested: argv.includes('--export'),
  exportDir: getFlagPathValue(argv, '--export'),
  projectDir: getFlagValue(argv, '--project'),
  libraryKind: getFlagValue(argv, '--kind'),
  libraryCategory: getFlagValue(argv, '--category'),
  librarySets: getFlagValues(argv, '--set'),
  libraryAs: getFlagValue(argv, '--as'),
  libraryInto: getFlagValue(argv, '--into'),
  noWire: argv.includes('--no-wire'),
  ...parseLibraryOperationFlags(argv),
  skillsTarget: getFlagValue(argv, '--target'),
})

/**
 * The switches only one verb reads — `library add`'s, `skills`' and `migrate`'s
 * `--allow-destructive` — carried into the result as parsed, each verb owning
 * its own refusal.
 */
const verbSwitchesOf = (
  flags: ParsedFlags
): Pick<
  ParsedArgs,
  | 'noWire'
  | 'libraryTag'
  | 'libraryLimit'
  | 'libraryAll'
  | 'libraryYes'
  | 'skillsTarget'
  | 'allowDestructive'
> => ({
  allowDestructive: flags.allowDestructive,
  noWire: flags.noWire,
  libraryTag: flags.libraryTag,
  libraryLimit: flags.libraryLimit,
  libraryAll: flags.libraryAll,
  libraryYes: flags.libraryYes,
  skillsTarget: flags.skillsTarget,
})

/** The `sovrium changelog` flags, read straight from argv. */
const changelogArgsOf = (
  argv: readonly string[]
): Pick<ParsedArgs, 'changelogList' | 'changelogSinceRequested' | 'changelogSince'> => ({
  changelogList: argv.includes('--list'),
  changelogSinceRequested: argv.includes('--since'),
  changelogSince: getFlagPathValue(argv, '--since'),
})

/** The `sovrium seed` flags, carried into the result as parsed. */
const seedArgsOf = (
  flags: ParsedFlags
): Pick<ParsedArgs, 'seedDir' | 'seedMode' | 'seedTables' | 'seedAs' | 'seedToday'> => ({
  seedDir: flags.seedDir,
  seedMode: flags.seedMode,
  seedTables: flags.seedTables,
  seedAs: flags.seedAs,
  seedToday: flags.seedToday,
})

/**
 * Build the standard noun-verb result (everything that isn't an early-exit
 * or implicit-config-file shortcut). Split out of `parseArgs` to keep it
 * under the per-function line cap.
 */
/* eslint-disable max-params -- `argv` (5th param) is needed to surface helpRequested without re-parsing */
const buildStandardResult = (
  command: string,
  configFile: string | undefined,
  flags: ParsedFlags,
  nonFlagArgs: readonly string[],
  argv: readonly string[]
): ParsedArgs => {
  // Noun-verb commands (admin/secret): 2nd positional is the verb,
  // 3rd is the verb's argument (admin email or secret scope).
  const isNounVerb = NOUN_VERB_COMMANDS.includes(command as (typeof NOUN_VERB_COMMANDS)[number])
  const subcommand = isNounVerb ? nonFlagArgs[1] : undefined
  const positionalArg = isNounVerb ? nonFlagArgs[2] : undefined
  const helpRequested = argv.includes('--help') || argv.includes('-h')

  return {
    command,
    configFile,
    watchMode: flags.watchMode,
    outputPath: flags.outputPath,
    dataDir: flags.dataDir,
    templateName: flags.templateName,
    subcommand,
    appName: flags.appName,
    typescript: flags.typescript,
    gitInit: flags.gitInit,
    fromUrl: flags.fromUrl,
    forceFlag: flags.forceFlag,
    publicDir: flags.publicDir,
    positionalArg,
    password: flags.password,
    helpRequested,
    ...seedArgsOf(flags),
    dryRun: flags.dryRun,
    check: flags.check,
    json: flags.json,
    format: flags.format,
    full: flags.full,
    listSections: flags.listSections,
    lang: flags.lang,
    docsSections: flags.docsSections,
    exportRequested: flags.exportRequested,
    exportDir: flags.exportDir,
    positionalArgs: nonFlagArgs.slice(1),
    projectDir: flags.projectDir,
    libraryKind: flags.libraryKind,
    libraryCategory: flags.libraryCategory,
    librarySets: flags.librarySets,
    libraryAs: flags.libraryAs,
    libraryInto: flags.libraryInto,
    ...verbSwitchesOf(flags),
    ...changelogArgsOf(argv),
  }
}
/* eslint-enable max-params */

/**
 * Parse CLI arguments into command, config file, and flags
 */
export const parseArgs = (argv: readonly string[]): ParsedArgs => {
  const earlyExit = detectEarlyExit(argv)
  if (earlyExit) return earlyExit

  const flags = parseAllFlags(argv)
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
      publicDir: flags.publicDir,
      // Carried here too, not only in `buildStandardResult`: this branch is how
      // `sovrium app.yaml --help` parses, and without the flag the central
      // `--help` short-circuit in index.ts cannot see it — so asking for help
      // would boot a server instead.
      helpRequested: hasFlag(argv, '--help', '-h'),
    }
  }

  return buildStandardResult(command, configFile, flags, nonFlagArgs, argv)
}
