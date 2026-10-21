/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { REDACTED_REPORT_VALUE } from '@/domain/kernel/sanitize/issue-report-redaction'
import {
  buildIssueReportUrl,
  computeErrorSignature,
  formatIssueTitle,
  type IssueFormFieldValue,
  type IssueFormFields,
} from '@/domain/kernel/url/issue-report-url'
import { packageManagerOfExecPath } from '@/domain/kernel/url/package-manager-install'

/**
 * What a bug report says about the installation, and what a failure report
 * says about the failure — the half of reporting that is the same wherever the
 * report is offered (the `report` verb, a failed start or build, a crash, a
 * server error found by its request id, a run that stopped on an internal
 * error). The URL itself is {@link buildIssueReportUrl}'s.
 *
 * Pure: the caller reads the process (environment, version, platform) and
 * passes the values in.
 */

/** An install channel, worded as the bug form's dropdown words it. */
export type InstallChannel = IssueFormFieldValue<'install-channel'>

/** A database, worded as the bug form's dropdown words it. */
export type DatabaseKind = IssueFormFieldValue<'database'>

/** The four facts every bug report carries. */
export interface IssueReportFacts {
  readonly version: string
  /** The platform and the processor architecture, `linux x64`. */
  readonly os: string
  readonly installChannel: InstallChannel
  readonly database: DatabaseKind
}

/** The install markers an install sets for itself, by the form's wording. */
const MARKED_CHANNELS: Readonly<Record<string, InstallChannel>> = {
  binary: 'Binary',
  desktop: 'Desktop app',
  docker: 'Docker',
  homebrew: 'Homebrew',
  scoop: 'Scoop',
}

/** What the install channel is read from. */
export interface InstallChannelProbe {
  /** `SOVRIUM_INSTALL_METHOD`, the marker the image, the desktop app and the tests set. */
  readonly marker: string | undefined
  /** This binary's own path. */
  readonly execPath: string
  /** Whether this is a compiled binary rather than the source tree run by Bun. */
  readonly compiled: boolean
}

/**
 * How this Sovrium was installed: its marker when it set one, else a package
 * manager recognised from the binary's own path
 * ({@link packageManagerOfExecPath}), else a binary — or, when the
 * process runs from the source tree, `Built from source`.
 */
export const installChannelOf = (probe: InstallChannelProbe): InstallChannel => {
  const marked = MARKED_CHANNELS[probe.marker?.trim().toLowerCase() ?? '']
  if (marked !== undefined) return marked
  if (!probe.compiled) return 'Built from source'
  const manager = packageManagerOfExecPath(probe.execPath)
  if (manager === 'homebrew') return 'Homebrew'
  if (manager === 'scoop') return 'Scoop'
  return 'Binary'
}

/**
 * The database a `DATABASE_URL` names, read off its scheme alone: nothing is
 * dialled and nothing of the address is kept.
 */
export const databaseKindOf = (databaseUrl: string | undefined): DatabaseKind =>
  /^postgres(?:ql)?:\/\//i.test(databaseUrl?.trim() ?? '') ? 'PostgreSQL' : 'SQLite'

/** The bug form's fields for `facts`, plus whatever the report adds. */
export const bugReportFields = (
  facts: IssueReportFacts,
  extra: IssueFormFields<'bug.yml'> = {}
): IssueFormFields<'bug.yml'> => ({
  version: facts.version,
  os: facts.os,
  'install-channel': facts.installChannel,
  database: facts.database,
  ...extra,
})

// --- Scrubbing ---------------------------------------------------------------

/**
 * Whether an environment variable's name marks its value as secret: a name
 * holding `SECRET`, `PASSWORD` or `TOKEN`, ending in `_KEY`, or `DATABASE_URL`.
 */
export const isSecretEnvName = (name: string): boolean =>
  /SECRET|PASSWORD|TOKEN/i.test(name) || /_KEY$/i.test(name) || /^DATABASE_URL$/i.test(name)

/** A value shorter than this is not searched for: it would match ordinary words. */
const MIN_SECRET_LENGTH = 6

/**
 * The values of the secret-named variables in `env`, longest first, so a
 * value containing another is replaced whole.
 */
export const secretEnvValues = (
  env: Readonly<Record<string, string | undefined>>
): readonly string[] =>
  Array.from(
    new Set(
      Object.entries(env)
        .filter(
          ([name, value]) => isSecretEnvName(name) && (value?.length ?? 0) >= MIN_SECRET_LENGTH
        )
        .map(([, value]) => value ?? '')
    )
  ).toSorted((a, b) => b.length - a.length)

/** What a report's text is cleaned of before it leaves the machine. */
export interface ReportScrub {
  /** Values never to print, wherever they appear (secret variables' values). */
  readonly secretValues: readonly string[]
  /** The project's directory, in every spelling it may appear in (a symlink's target too). */
  readonly projectDirs: readonly string[]
  /** The home directory. */
  readonly home: string | undefined
}

/** `text` with each of `values` replaced by the redaction marker. */
export const redactValues = (text: string, values: readonly string[]): string =>
  values.reduce(
    (current, value) => (value === '' ? current : current.split(value).join(REDACTED_REPORT_VALUE)),
    text
  )

/**
 * A stack frame's location under Sovrium's own `src/` tree, rewritten as the
 * repository-relative path (`src/index.ts:12:3`), so a frame names the code and
 * not the directory it was installed or checked out into.
 */
const normalizeSourcePaths = (text: string): string =>
  text.replace(/(?:file:\/\/)?[^\s()'"]*[\\/]src[\\/][^\s()'"]*/g, (token) => {
    const path = token.replace(/\\/g, '/')
    return `src/${path.slice(path.lastIndexOf('/src/') + '/src/'.length)}`
  })

/**
 * `text` with the project directory read as `.` and the home directory as `~`,
 * every frame of Sovrium's own code made repository-relative, and every
 * secret value redacted.
 */
export const scrubReportText = (text: string, scrub: ReportScrub): string => {
  const redacted = redactValues(text, scrub.secretValues)
  const dirs = [...scrub.projectDirs]
    .filter((dir) => dir.length > 1)
    .toSorted((a, b) => b.length - a.length)
  const relative = dirs.reduce((current, dir) => current.split(dir).join('.'), redacted)
  const home = scrub.home !== undefined && scrub.home.length > 1 ? scrub.home : undefined
  const homeless = home === undefined ? relative : relative.split(home).join('~')
  return normalizeSourcePaths(homeless)
}

// --- Failure reports ----------------------------------------------------------

/** A failure, as a report needs it. An `Error` passes as-is. */
export interface ReportedFailure {
  readonly name: string
  readonly stack?: string | undefined
}

/** The prefilled bug report a failure offers: its title and its address. */
export interface FailureReport {
  readonly title: string
  readonly signature: string
  readonly url: string
}

/**
 * The bug report for a failure of `command`: titled with the command, the
 * error class and its signature, `logs` holding `text` (scrubbed by the
 * caller), the installation facts filled in.
 */
export const buildFailureReport = (input: {
  readonly command: string
  readonly failure: ReportedFailure
  readonly logs: string
  readonly facts: IssueReportFacts
}): FailureReport => {
  const signature = computeErrorSignature(input.failure)
  const title = formatIssueTitle(input.command, input.failure.name, signature)
  return {
    title,
    signature,
    url: buildIssueReportUrl({
      form: 'bug.yml',
      title,
      fields: bugReportFields(input.facts, { logs: input.logs }),
    }),
  }
}

/**
 * What an error class name looks like. A failure's `name` is free to be any
 * text — a plain object failed with can carry a `name` that is a person's or a
 * record's — and the name titles a PUBLIC report and a log line, so only a
 * class-shaped one is used.
 */
const CLASS_NAME = /^[A-Za-z_$][\w$.]{0,79}$/

const asClassName = (value: unknown): string | undefined =>
  typeof value === 'string' && CLASS_NAME.test(value) ? value : undefined

/** The name a caught value reports under: its own class name, else `Error`. */
export const failureName = (error: unknown): string => {
  if (error instanceof Error) return asClassName(error.name) ?? 'Error'
  if (error !== null && typeof error === 'object') {
    const { _tag, name } = error as { readonly _tag?: unknown; readonly name?: unknown }
    return asClassName(name) ?? asClassName(_tag) ?? 'Error'
  }
  return 'Error'
}

/** The stack a caught value carries, if any. */
export const failureStack = (error: unknown): string | undefined => {
  if (error === null || typeof error !== 'object') return undefined
  const { stack } = error as { readonly stack?: unknown }
  return typeof stack === 'string' ? stack : undefined
}

// --- An attached configuration -------------------------------------------------

/**
 * The defaults of a config's `env` entries that are secret — every one whose
 * entry does not say `secret: false`, the rule the console follows when it
 * shows the configuration as booted.
 */
export const secretEnvDefaultsOf = (config: unknown): readonly string[] => {
  if (config === null || typeof config !== 'object') return []
  const { env } = config as { readonly env?: unknown }
  if (!Array.isArray(env)) return []
  return env.flatMap((entry: unknown) => {
    if (entry === null || typeof entry !== 'object') return []
    const { default: value, secret } = entry as {
      readonly default?: unknown
      readonly secret?: unknown
    }
    if (secret === false) return []
    return typeof value === 'string' || typeof value === 'number' ? [String(value)] : []
  })
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * `text` (a configuration file as written) with each of `defaults` redacted
 * where it is the value of a `default` key — and only there, so a default that
 * happens to equal an ordinary word elsewhere in the file is left alone.
 */
export const redactEnvDefaults = (text: string, defaults: readonly string[]): string =>
  defaults.reduce(
    (current, value) =>
      value === ''
        ? current
        : current.replace(
            new RegExp(
              `(\\bdefault["']?\\s*[:=]\\s*["']?)${escapeRegExp(value)}(?=["']?(?:[\\s,}\\]]|$))`,
              'g'
            ),
            (_match, head: string) => `${head}${REDACTED_REPORT_VALUE}`
          ),
    text
  )
