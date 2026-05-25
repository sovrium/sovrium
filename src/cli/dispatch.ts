/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

const isConfigFile = (arg: string | undefined): boolean =>
  arg !== undefined && (CONFIG_EXTENSIONS.some((ext) => arg.endsWith(ext)) || arg.includes('/'))

export interface ParsedArgs {
  readonly command: string
  readonly configFile?: string
  readonly watchMode: boolean
  readonly outputPath?: string
  readonly templateName?: string
  readonly subcommand?: string
  readonly targetPath?: string
  readonly agentName?: string
  readonly appName?: string
  readonly forceFlag: boolean
  readonly skipAgent: boolean
  readonly publicDir?: string
  readonly positionalArg?: string
  readonly password?: string
  readonly helpRequested?: boolean
}

const hasFlag = (argv: readonly string[], long: string, short: string): boolean =>
  argv.includes(long) || argv.includes(short)

const getFlagValue = (argv: readonly string[], flag: string): string | undefined => {
  const index = argv.indexOf(flag)
  return index !== -1 ? argv[index + 1] : undefined
}

const FLAG_VALUE_OPTIONS = [
  '--output',
  '--template',
  '--target',
  '--publicDir',
  '--name',
  '--password',
] as const

const NOUN_VERB_COMMANDS = ['agents', 'admin', 'secret'] as const

const KNOWN_BOOLEAN_FLAGS: ReadonlySet<string> = new Set([
  '--help',
  '-h',
  '--version',
  '-v',
  '--watch',
  '-w',
  '--force',
  '--no-agent',
])

const KNOWN_VALUE_FLAGS: ReadonlySet<string> = new Set([
  '--output',
  '--template',
  '--target',
  '--publicDir',
  '--name',
  '--password',
])

const stripEqValue = (arg: string): string =>
  arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg

export const findUnknownFlag = (argv: readonly string[]): string | undefined => {
  const offenders = argv.filter((arg, i) => {
    if (!arg.startsWith('-')) return false
    const flag = stripEqValue(arg)
    if (KNOWN_BOOLEAN_FLAGS.has(flag)) return false
    if (KNOWN_VALUE_FLAGS.has(flag)) return false
    const prev = i > 0 ? argv[i - 1] : undefined
    if (prev !== undefined && KNOWN_VALUE_FLAGS.has(stripEqValue(prev)) && !prev.includes('=')) {
      return false
    }
    return true
  })
  return offenders[0]
}

const extractNonFlagArgs = (argv: readonly string[]): readonly string[] =>
  argv.filter(
    (arg, i) =>
      !arg.startsWith('-') &&
      (i === 0 || !FLAG_VALUE_OPTIONS.includes(argv[i - 1] as (typeof FLAG_VALUE_OPTIONS)[number]))
  )

const detectEarlyExit = (argv: readonly string[]): ParsedArgs | undefined => {
  const firstPositional = argv.find((arg) => !arg.startsWith('-'))
  if (hasFlag(argv, '--help', '-h') && firstPositional === undefined) {
    return {
      command: '--help',
      configFile: undefined,
      watchMode: false,
      forceFlag: false,
      skipAgent: false,
    }
  }
  if (hasFlag(argv, '--version', '-v')) {
    return {
      command: '--version',
      configFile: undefined,
      watchMode: false,
      forceFlag: false,
      skipAgent: false,
    }
  }
  return undefined
}

interface ParsedFlags {
  readonly watchMode: boolean
  readonly forceFlag: boolean
  readonly skipAgent: boolean
  readonly outputPath: string | undefined
  readonly templateName: string | undefined
  readonly targetPath: string | undefined
  readonly publicDir: string | undefined
  readonly appName: string | undefined
  readonly password: string | undefined
}

const parseAllFlags = (argv: readonly string[]): ParsedFlags => ({
  watchMode: hasFlag(argv, '--watch', '-w'),
  forceFlag: argv.includes('--force'),
  skipAgent: argv.includes('--no-agent'),
  outputPath: getFlagValue(argv, '--output'),
  templateName: getFlagValue(argv, '--template'),
  targetPath: getFlagValue(argv, '--target'),
  publicDir: getFlagValue(argv, '--publicDir'),
  appName: getFlagValue(argv, '--name'),
  password: getFlagValue(argv, '--password'),
})

const buildStandardResult = (
  command: string,
  configFile: string | undefined,
  flags: ParsedFlags,
  nonFlagArgs: readonly string[],
  argv: readonly string[]
): ParsedArgs => {
  const isNounVerb = NOUN_VERB_COMMANDS.includes(command as (typeof NOUN_VERB_COMMANDS)[number])
  const subcommand = isNounVerb ? nonFlagArgs[1] : undefined
  const agentName = command === 'agents' ? nonFlagArgs[2] : undefined
  const positionalArg = command === 'agents' ? undefined : isNounVerb ? nonFlagArgs[2] : undefined
  const helpRequested = argv.includes('--help') || argv.includes('-h')

  return {
    command,
    configFile,
    watchMode: flags.watchMode,
    outputPath: flags.outputPath,
    templateName: flags.templateName,
    subcommand,
    targetPath: flags.targetPath,
    agentName,
    appName: flags.appName,
    forceFlag: flags.forceFlag,
    skipAgent: flags.skipAgent,
    publicDir: flags.publicDir,
    positionalArg,
    password: flags.password,
    helpRequested,
  }
}

export const parseArgs = (argv: readonly string[]): ParsedArgs => {
  const earlyExit = detectEarlyExit(argv)
  if (earlyExit) return earlyExit

  const flags = parseAllFlags(argv)
  const nonFlagArgs = extractNonFlagArgs(argv)
  const command = nonFlagArgs[0] || 'start'
  const configFile = command === 'admin' ? nonFlagArgs[3] : nonFlagArgs[1]

  if (isConfigFile(command)) {
    return {
      command: 'start',
      configFile: command,
      watchMode: flags.watchMode,
      outputPath: flags.outputPath,
      templateName: flags.templateName,
      appName: flags.appName,
      forceFlag: flags.forceFlag,
      skipAgent: flags.skipAgent,
      publicDir: flags.publicDir,
    }
  }

  return buildStandardResult(command, configFile, flags, nonFlagArgs, argv)
}
