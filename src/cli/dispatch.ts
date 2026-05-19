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
  readonly publicDir?: string
}

const hasFlag = (argv: readonly string[], long: string, short: string): boolean =>
  argv.includes(long) || argv.includes(short)

const getFlagValue = (argv: readonly string[], flag: string): string | undefined => {
  const index = argv.indexOf(flag)
  return index !== -1 ? argv[index + 1] : undefined
}

const FLAG_VALUE_OPTIONS = ['--output', '--template', '--target', '--publicDir', '--name'] as const

const extractNonFlagArgs = (argv: readonly string[]): readonly string[] =>
  argv.filter(
    (arg, i) =>
      !arg.startsWith('-') &&
      (i === 0 || !FLAG_VALUE_OPTIONS.includes(argv[i - 1] as (typeof FLAG_VALUE_OPTIONS)[number]))
  )

const detectEarlyExit = (argv: readonly string[]): ParsedArgs | undefined => {
  if (hasFlag(argv, '--help', '-h')) {
    return { command: '--help', configFile: undefined, watchMode: false, forceFlag: false }
  }
  if (hasFlag(argv, '--version', '-v')) {
    return { command: '--version', configFile: undefined, watchMode: false, forceFlag: false }
  }
  return undefined
}

export const parseArgs = (argv: readonly string[]): ParsedArgs => {
  const earlyExit = detectEarlyExit(argv)
  if (earlyExit) return earlyExit

  const watchMode = hasFlag(argv, '--watch', '-w')
  const forceFlag = argv.includes('--force')
  const outputPath = getFlagValue(argv, '--output')
  const templateName = getFlagValue(argv, '--template')
  const targetPath = getFlagValue(argv, '--target')
  const publicDir = getFlagValue(argv, '--publicDir')
  const appName = getFlagValue(argv, '--name')

  const nonFlagArgs = extractNonFlagArgs(argv)
  const command = nonFlagArgs[0] || 'start'
  const configFile = nonFlagArgs[1]

  if (isConfigFile(command)) {
    return {
      command: 'start',
      configFile: command,
      watchMode,
      outputPath,
      templateName,
      appName,
      forceFlag,
      publicDir,
    }
  }

  const subcommand = command === 'agents' ? nonFlagArgs[1] : undefined
  const agentName = command === 'agents' ? nonFlagArgs[2] : undefined

  return {
    command,
    configFile,
    watchMode,
    outputPath,
    templateName,
    subcommand,
    targetPath,
    agentName,
    appName,
    forceFlag,
    publicDir,
  }
}
