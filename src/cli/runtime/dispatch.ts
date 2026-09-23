/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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

export interface ParsedArgs {
  readonly command: string
  readonly configFile?: string
  readonly watchMode: boolean
  readonly outputPath?: string
  readonly templateName?: string
  readonly subcommand?: string
  readonly appName?: string
  /**
   * `--typescript` — scaffold a typed `app.ts` instead of `app.yaml` (`init`).
   *
   * Deliberately an EITHER/OR rather than an addition: `app.yaml` shadows
   * `app.ts` in `DEFAULT_CONFIG_FILENAMES`, so scaffolding both would leave the
   * typed config inert and edited-but-never-read.
   */
  readonly typescript?: boolean
  /**
   * `--git` — run `git init` and land one commit over the fresh scaffold
   * (`init`).
   *
   * A convenience, never a prerequisite: undo is engine-owned and works with
   * no repository at all, so a host without `git` loses this and nothing else.
   */
  readonly gitInit?: boolean
  /**
   * `--from-url <https://…>` — fork ONE published config document (`init`).
   *
   * Distinct from `--template owner/repo`, which fetches a whole repository.
   * This is the shape a gallery, a blog post or a colleague can publish
   * without owning one.
   */
  readonly fromUrl?: string
  readonly forceFlag: boolean
  /**
   * Static-asset directory for `start` / `build`.
   *
   * - `string`    — explicit path from `--publicDir <path>`.
   * - `false`     — explicit opt-out from `--no-publicDir`. Suppresses both
   *                 the env-var fallback AND the anchored `./public` default.
   * - `undefined` — no flag; caller falls back to env → anchored default.
   */
  readonly publicDir?: string | false
  /** Third positional arg for noun-verb commands (e.g. `admin create <email>`, `secret generate <scope>`). */
  readonly positionalArg?: string
  /** Value of --password (admin create scripting/CI override). */
  readonly password?: string
  /**
   * `--help`/`-h` was present in argv AND a positional command preceded it.
   * The global `--help` short-circuit only fires when there is NO leading
   * positional, so this flag lets sub-command handlers (`admin`, `secret`, …)
   * emit their own context-specific help text without having
   * to inspect raw argv themselves.
   */
  readonly helpRequested?: boolean
  /** `--dir <path>` — seed-file directory for `sovrium seed`. */
  readonly seedDir?: string
  /**
   * `--mode <value>` — the RAW string, deliberately unvalidated here.
   *
   * `sovrium seed` owns the refusal so it can print the accepted set; a parser
   * that quietly fell back to the default would run `if-empty` when the
   * operator typed `replace`, and the nightly reset would report success while
   * refreshing nothing.
   */
  readonly seedMode?: string
  /**
   * Every `--table <name>` occurrence, in argv order.
   *
   * Repeatable by design: `sovrium seed --table deals --table tasks` must seed
   * BOTH. A single-value reader would silently honour the first and leave the
   * second table empty behind a green exit code.
   */
  readonly seedTables?: readonly string[]
  /** `--dry-run` — report the plan, write nothing. */
  readonly dryRun?: boolean
  /**
   * `--check` — answer whether the database is safe to migrate, write nothing.
   *
   * Distinct from `--dry-run` rather than a mode of it: a dry run answers "what
   * would change", a check answers "would it survive". They exit on different
   * grounds — a check exits 1 on an unsafe database that a dry run would happily
   * describe — so collapsing them would make one of the two exit codes a lie.
   */
  readonly check?: boolean
  /**
   * `--json` — report the verdict as one JSON document on stdout.
   *
   * `sovrium validate`'s machine-readable mode. Distinct from `--format`, which
   * names an output DIALECT for a document a human still reads: this switches
   * who the command is talking to, and with it the promise that stdout carries
   * nothing a `JSON.parse` would choke on.
   */
  readonly json?: boolean
  /**
   * `--format <value>` — the RAW string, deliberately unvalidated here.
   *
   * `sovrium design-system` owns the refusal so it can print the accepted set.
   * A parser that quietly fell back to the default would hand a CI step asking
   * for `yaml` a markdown file, exit 0, and let nobody look again.
   */
  readonly format?: string
  /** `--full` — print the whole manual rather than an index (`docs`). */
  readonly full?: boolean
  /** `--list-sections` — print the section vocabulary and stop (`docs`). */
  readonly listSections?: boolean
  /**
   * `--lang <value>` — the RAW string, deliberately unvalidated here.
   *
   * `sovrium docs` owns the refusal for the same reason `--format` is left
   * raw: the in-binary manual is English, and serving English to a reader who
   * asked for French is precisely the failure the flag exists to prevent.
   */
  readonly lang?: string
  /**
   * Every `--section <slug>` occurrence, in argv order.
   *
   * Repeatable by design: `sovrium docs --full --section tables --section forms`
   * must print BOTH. A single-value reader would honour the first and drop the
   * second behind a green exit code, which is the `--table` defect one flag up.
   */
  readonly docsSections?: readonly string[]
  /**
   * `--export <dir>` — `sovrium docs` writes every article plus a manifest.
   *
   * `exportRequested` is carried separately from the directory because a bare
   * `--export` must be REFUSED by name, not read as "no export": run from a
   * project root, silently falling back to the working directory would write
   * two hundred files beside `app.ts`.
   */
  readonly exportRequested?: boolean
  readonly exportDir?: string
  /**
   * Every positional argument AFTER the command word, in argv order.
   *
   * `sovrium docs` addresses articles, subcommands and lookup keys positionally
   * — `docs app-schema/llms-txt`, `docs config llms.full`, `docs search llms` —
   * and none of those fit the `configFile` / `subcommand` / `positionalArg`
   * slots, which are shaped for `admin create <email> [config]`.
   */
  readonly positionalArgs?: readonly string[]
  /**
   * `--project <dir>` — the directory `sovrium mcp` reads its config from.
   *
   * Distinct from `configFile`, and deliberately: the stdio MCP verb is handed
   * a PROJECT, not a document. It then discovers the config inside it exactly
   * as `sovrium start` does, so a client's saved invocation keeps working when
   * the author renames `app.yaml` to `app.ts`.
   */
  readonly projectDir?: string
}

const hasFlag = (argv: readonly string[], long: string, short: string): boolean =>
  argv.includes(long) || argv.includes(short)

const getFlagValue = (argv: readonly string[], flag: string): string | undefined => {
  const index = argv.indexOf(flag)
  return index !== -1 ? argv[index + 1] : undefined
}

/**
 * Every value of a repeatable value-flag, in argv order.
 *
 * `getFlagValue` uses `indexOf`, which stops at the first occurrence — correct
 * for `--output`, wrong for `--table`. A trailing `--table` with no argument
 * contributes nothing rather than swallowing the next flag.
 */
/**
 * A value-flag's value, where a following FLAG counts as no value at all.
 *
 * `getFlagValue` returns the next token whatever it is, which would read
 * `docs --export --full` as an export into a directory named `--full`. For a
 * flag whose value is a path the caller will write into, that is the wrong
 * guess in the most expensive direction.
 */
const getFlagPathValue = (argv: readonly string[], flag: string): string | undefined => {
  const value = getFlagValue(argv, flag)
  return value === undefined || value.startsWith('-') ? undefined : value
}

const getFlagValues = (argv: readonly string[], flag: string): readonly string[] =>
  argv.flatMap((arg, index) => {
    if (arg !== flag) return []
    const value = argv[index + 1]
    return value === undefined || value.startsWith('-') ? [] : [value]
  })

const FLAG_VALUE_OPTIONS = [
  '--output',
  '--template',
  // Listed here as well as in KNOWN_VALUE_FLAGS: omitting a value-flag leaves
  // its value in the positional stream, so `sovrium init --from-url <url> ./dir`
  // would treat the URL as the target directory.
  '--from-url',
  '--publicDir',
  '--name',
  '--password',
  // `sovrium seed` — every one of these MUST be listed here as well as in
  // KNOWN_VALUE_FLAGS. Omitting a value-flag leaves its value in the positional
  // stream, so `sovrium seed --mode upsert app.yaml` would treat the string
  // `upsert` as the config path and report "file not found: upsert".
  '--dir',
  '--mode',
  '--table',
  // `sovrium design-system --format md|json`. Listed here as well as in
  // KNOWN_VALUE_FLAGS: omitting a value-flag leaves its value in the positional
  // stream, so `sovrium design-system --format json app.yaml` would treat the
  // string `json` as the config path.
  '--format',
  // `sovrium docs --lang en --section tables`. Same rule: absent here, `en`
  // would be read as the article address and `docs --lang en` would refuse a
  // section nobody registered.
  '--lang',
  '--section',
  // `sovrium docs --export <dir>`. Both lists, same reason: absent here, the
  // directory would be read as the article address.
  '--export',
  // `sovrium mcp --project <dir>`. Both lists again, and this one bites in a
  // way the others do not: `--project /tmp/app` leaves `/tmp/app` in the
  // positional stream, where `isConfigFile` matches it on the `/` and rewrites
  // the whole invocation into an implicit `start`.
  '--project',
] as const

/** Commands that use two-level noun-verb dispatch (verb in 2nd positional slot). */
const NOUN_VERB_COMMANDS = ['admin', 'secret'] as const

/**
 * The set of flags the CLI recognizes. Anything else passed with a `--` or
 * `-X` prefix is rejected with an error that names the offending flag, so a
 * typo (`--definitely-not-a-flag-xyzzy`) does not silently fall through to
 * the implicit `start` command and emit a misleading "No configuration
 * provided" message.
 */
const KNOWN_BOOLEAN_FLAGS: ReadonlySet<string> = new Set([
  '--help',
  '-h',
  '--version',
  '-v',
  '--watch',
  '-w',
  '--force',
  '--no-publicDir',
  // `sovrium init --typescript`. Absent from this set, `findUnknownFlag`
  // rejects it outright — a refusal that reads like operator error rather
  // than a gap.
  '--typescript',
  // `sovrium init --git`. Absent from this set, `findUnknownFlag` rejects it
  // outright — a refusal that reads like operator error rather than a gap.
  '--git',
  // `sovrium seed --dry-run`, `sovrium migrate --dry-run`
  '--dry-run',
  // `sovrium migrate --check`. Absent from this set, `findUnknownFlag` rejects
  // the flag outright, so the mode is unreachable however well it is wired.
  '--check',
  // `sovrium docs --full`, `sovrium docs --list-sections`.
  '--full',
  '--list-sections',
  // `sovrium validate --json`. Same note as `--check`: a flag missing from this
  // set is refused at parse time, so the machine-readable report would be
  // unreachable however completely the command implemented it.
  '--json',
])

const KNOWN_VALUE_FLAGS: ReadonlySet<string> = new Set([
  '--output',
  '--template',
  // `sovrium init --from-url <https://…>`. A published config document forked
  // into the project, as opposed to `--template`'s whole repository.
  '--from-url',
  '--publicDir',
  '--name',
  '--password',
  // [internal ref]: `sovrium reload --message "..."` records the
  // operator's commit message on the new version row.
  '--message',
  // `sovrium seed`. Absent from this set, `findUnknownFlag` rejects the flag
  // outright — a refusal that reads like operator error rather than a gap.
  '--dir',
  '--mode',
  '--table',
  // `sovrium design-system`. Absent from this set, `findUnknownFlag` rejects
  // the flag outright — a refusal naming the flag but not the accepted values.
  '--format',
  // `sovrium docs`. Same reason: the command owns both refusals so it can
  // print the accepted locale and the registered section slugs.
  '--lang',
  '--section',
  // `sovrium docs --export <dir>`. Absent from this set the flag is refused
  // before dispatch as an unknown flag.
  '--export',
  // `sovrium mcp --project <dir>`. Absent from this set the flag is refused
  // before dispatch, so the verb would be unreachable however completely it is
  // implemented.
  '--project',
])

/** Strip `=value` from `--flag=value` so the bare flag name can be matched. */
const stripEqValue = (arg: string): string =>
  arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg

/**
 * Find the first argv token that looks like a flag (`--foo` or `-x`) but is
 * not in the known-flag allow-list. Returns the offending token, or `undefined`
 * if every flag in `argv` is recognized.
 *
 * A token in the position immediately after a `KNOWN_VALUE_FLAGS` flag is
 * treated as that flag's value and skipped — that captures `--output /tmp/x`
 * (where `/tmp/x` is the value) without rejecting `/tmp/x` as a positional.
 */
export const findUnknownFlag = (argv: readonly string[]): string | undefined => {
  const offenders = argv.filter((arg, i) => {
    if (!arg.startsWith('-')) return false
    const flag = stripEqValue(arg)
    if (KNOWN_BOOLEAN_FLAGS.has(flag)) return false
    if (KNOWN_VALUE_FLAGS.has(flag)) return false
    // If the previous token is a known value-flag and this token does NOT
    // start with `--` or look like a flag-name itself, it's a value not a flag.
    const prev = i > 0 ? argv[i - 1] : undefined
    if (prev !== undefined && KNOWN_VALUE_FLAGS.has(stripEqValue(prev)) && !prev.includes('=')) {
      return false
    }
    return true
  })
  return offenders[0]
}

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
  readonly dryRun: boolean
  readonly check: boolean
  readonly json: boolean
  readonly format: string | undefined
  readonly full: boolean
  readonly listSections: boolean
  readonly lang: string | undefined
  readonly docsSections: readonly string[]
  readonly exportRequested: boolean
  readonly exportDir: string | undefined
  readonly projectDir: string | undefined
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

const parseAllFlags = (argv: readonly string[]): ParsedFlags => ({
  watchMode: hasFlag(argv, '--watch', '-w'),
  forceFlag: argv.includes('--force'),
  outputPath: getFlagValue(argv, '--output'),
  templateName: getFlagValue(argv, '--template'),
  publicDir: resolvePublicDirFlag(argv),
  appName: getFlagValue(argv, '--name'),
  typescript: argv.includes('--typescript'),
  gitInit: argv.includes('--git'),
  fromUrl: getFlagValue(argv, '--from-url'),
  password: getFlagValue(argv, '--password'),
  seedDir: getFlagValue(argv, '--dir'),
  seedMode: getFlagValue(argv, '--mode'),
  seedTables: getFlagValues(argv, '--table'),
  dryRun: argv.includes('--dry-run'),
  check: argv.includes('--check'),
  json: argv.includes('--json'),
  format: getFlagValue(argv, '--format'),
  full: argv.includes('--full'),
  listSections: argv.includes('--list-sections'),
  lang: getFlagValue(argv, '--lang'),
  docsSections: getFlagValues(argv, '--section'),
  exportRequested: argv.includes('--export'),
  exportDir: getFlagPathValue(argv, '--export'),
  projectDir: getFlagValue(argv, '--project'),
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
    seedDir: flags.seedDir,
    seedMode: flags.seedMode,
    seedTables: flags.seedTables,
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
