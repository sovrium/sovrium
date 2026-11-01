/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium import` — reading the command line, and every refusal that needs
 * nothing but the command line. Each happens before a file is read or a byte
 * is written.
 */

import { refuse } from '@/cli/commands/app-prelude'
import { defineFlags, flag, type FlagsOf } from '@/cli/runtime/flag-schema'
import { addressForDisplay } from '@/domain/models/import/capability-url-service'
import {
  IMPORT_DOMAINS,
  IMPORT_FETCH_SOURCES,
  IMPORT_SOURCE_TOOLS,
  type ImportDomain,
  type ImportFetchSource,
  type ImportSourceTool,
} from '@/domain/models/import/import-source'
import { AIRTABLE_INTERFACES, refuseAirtableInterfaces } from './page-deferrals'

export const IMPORT_USAGE = [
  'Usage:',
  '  sovrium import fetch <source-uri> [--out <dir>] [--token-env <VAR>] [--only <parts>] [--skip-attachments]',
  '  sovrium import <snapshot|file> [--config <file>] [--from <tool>] [--only <parts>]',
  '                 [--dry-run | --write] [--apply] [--prefix <p>] [--json] [--report <file>]',
].join('\n')

/** The accepted `--from` values, for refusals. */
export const TOOL_LIST = IMPORT_SOURCE_TOOLS.join(', ')

/** The accepted fetch schemes with their default variables, for refusals. */
export const SCHEME_LIST = IMPORT_FETCH_SOURCES.map(
  (source) => `    ${source.uri.padEnd(32)} token from ${source.tokenEnv}`
).join('\n')

/** What a conversion run was asked for. */
export interface ConvertRequest {
  readonly input: string
  readonly config: string | undefined
  readonly from: ImportSourceTool | undefined
  readonly only: readonly ImportDomain[] | undefined
  readonly write: boolean
  readonly apply: boolean
  readonly json: boolean
  readonly report: string | undefined
  readonly prefix: string | undefined
}

/** What a fetch run was asked for. */
export interface FetchRequest {
  readonly uri: string
  readonly source: ImportFetchSource
  readonly out: string | undefined
  readonly tokenEnv: string
  readonly only: readonly ImportDomain[] | undefined
  readonly skipAttachments: boolean
}

/** The flags `sovrium import` and `sovrium import fetch` read. */
export const importFlags = defineFlags({
  token: flag.occurrence('--token'),
  write: flag.switch('--write'),
  apply: flag.switch('--apply'),
  dryRun: flag.switch('--dry-run'),
  config: flag.value('--config'),
  from: flag.value('--from'),
  only: flag.value('--only'),
  json: flag.switch('--json'),
  report: flag.value('--report'),
  prefix: flag.value('--prefix'),
  tokenEnv: flag.value('--token-env'),
  out: flag.value('--out'),
  skipAttachments: flag.switch('--skip-attachments'),
})

/** {@link importFlags}, read. */
export type ImportFlags = FlagsOf<typeof importFlags>

/** `--only tables,data`, every part named, refused when one is not a part. */
const readOnly = (flags: ImportFlags): readonly ImportDomain[] | undefined => {
  const raw = flags.only
  if (raw === undefined) return undefined
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
  const unknown = parts.filter((part) => !IMPORT_DOMAINS.some((domain) => domain === part))
  if (parts.length === 0 || unknown.length > 0) {
    return refuse(
      `Error: --only "${raw}" names no part the import knows.\n\n  Accepted parts: ${IMPORT_DOMAINS.join(', ')} (comma-separated).`
    )
  }
  return IMPORT_DOMAINS.filter((domain) => parts.includes(domain))
}

const readFrom = (flags: ImportFlags): ImportSourceTool | undefined => {
  const raw = flags.from
  if (raw === undefined) return undefined
  if (raw.trim().toLowerCase() === AIRTABLE_INTERFACES) return refuseAirtableInterfaces()
  const tool = IMPORT_SOURCE_TOOLS.find((candidate) => candidate === raw.trim().toLowerCase())
  return (
    tool ?? refuse(`Error: Unsupported --from "${raw}".\n\n  Accepted --from values: ${TOOL_LIST}.`)
  )
}

/**
 * The refusal for a token typed on the command line. It names the variable to
 * use and never echoes what it was handed: a token in argv is already in the
 * shell's history, and the refusal must not put it in a log too.
 */
export const refuseTokenFlag = (flags: ImportFlags, argv: readonly string[]): void => {
  if (!flags.token.given) return
  const uri = argv.find((arg) => /^[a-z][a-z0-9-]*:/.test(arg) && !arg.startsWith('--'))
  const source =
    uri === undefined
      ? undefined
      : IMPORT_FETCH_SOURCES.find((one) => uri.startsWith(`${one.scheme}:`))
  const variable = source?.tokenEnv ?? 'the tool’s token variable (e.g. AIRTABLE_TOKEN)'
  refuse(
    `Error: sovrium import never takes a token on the command line.\n\n` +
      `  Put it in the environment instead (${variable}), or name another variable with --token-env <VAR>.\n` +
      '  A token typed as an argument is kept in your shell history; remove it from there too.'
  )
}

/** Read a conversion request off the flags (`import <input> …`). */
export const readConvertRequest = (
  flags: ImportFlags,
  positional: readonly string[]
): ConvertRequest => {
  const input = positional[0]
  if (input === undefined)
    return refuse(`Error: No snapshot, export file or source given.\n\n${IMPORT_USAGE}`)
  const { write, apply } = flags
  if (flags.dryRun && (write || apply)) {
    return refuse(
      `Error: ${write ? '--write' : '--apply'} and --dry-run contradict each other. Choose one.\n\n` +
        '  --dry-run (the default) prints the report and writes nothing; --write writes it; --apply writes, then seeds.'
    )
  }
  return {
    input,
    config: flags.config,
    from: readFrom(flags),
    only: readOnly(flags),
    write: write || apply,
    apply,
    json: flags.json,
    report: flags.report,
    prefix: flags.prefix,
  }
}

/** A fetch URI's source, or a refusal listing the schemes `fetch` reads. */
export const fetchSourceOf = (uri: string): ImportFetchSource => {
  const colon = uri.indexOf(':')
  const scheme = colon > 0 ? uri.slice(0, colon) : ''
  const source = /^[a-z][a-z0-9-]*$/.test(scheme)
    ? IMPORT_FETCH_SOURCES.find((candidate) => candidate.scheme === scheme)
    : undefined
  if (source !== undefined) return source
  const asFile = /\.(?:csv|xlsx|json|zip)$/i.test(uri) && !uri.includes('://')
  return refuse(
    `Error: "${addressForDisplay(uri)}" is not a source fetch can read.\n\n` +
      `  fetch reads a tool's API, named by a source URI:\n${SCHEME_LIST}\n` +
      (asFile
        ? `\n  An export file needs no fetch: it already is the snapshot. Convert it directly:\n    sovrium import ${uri}`
        : '\n  A URL is never a source: name the tool, so a fetch can only reach the tool you named.')
  )
}

/** The sources reached through a database connection URL, which their URI names by variable. */
export const CONNECTION_URL_TOOLS: ReadonlySet<string> = new Set(['retool-database', 'supabase'])

/** `$env.NAME`: a source that names the variable holding its connection string. */
const ENV_REFERENCE = /^\$env\.([A-Za-z_][A-Za-z0-9_]*)$/

/**
 * A database source's connection string is a secret, so its URI names the
 * variable holding it (`retool-db:$env.RETOOL_DB_URL`) and never holds it. A
 * URI holding anything else is refused WITHOUT being echoed: it may be the
 * connection string itself, password included.
 */
const connectionVariableOf = (uri: string, source: ImportFetchSource): string | undefined => {
  const rest = uri.slice(source.scheme.length + 1)
  if (rest === '') return undefined
  const named = ENV_REFERENCE.exec(rest)?.[1]
  return (
    named ??
    refuse(
      `Error: A ${source.scheme}: source names the environment variable that holds its connection URL; it never holds the URL itself.\n\n` +
        `  Put the URL in ${source.tokenEnv} and run: sovrium import fetch ${source.scheme}:$env.${source.tokenEnv}\n` +
        '  A URL typed as an argument is kept in your shell history; remove it from there too.'
    )
  )
}

/** Read a fetch request off the flags (`import fetch <uri> …`). */
export const readFetchRequest = (
  flags: ImportFlags,
  positional: readonly string[]
): FetchRequest => {
  const given = positional[1]
  if (given === undefined)
    return refuse(`Error: No source URI given.\n\n${IMPORT_USAGE}\n\n  Sources:\n${SCHEME_LIST}`)
  const source = fetchSourceOf(given)
  const byUrl = CONNECTION_URL_TOOLS.has(source.tool)
  const connection = byUrl ? connectionVariableOf(given, source) : undefined
  const tokenEnv = connection ?? flags.tokenEnv ?? source.tokenEnv
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tokenEnv)) {
    return refuse(`Error: --token-env "${tokenEnv}" is not an environment variable name.`)
  }
  const uri = byUrl ? `${source.scheme}:$env.${tokenEnv}` : given
  return {
    uri,
    source,
    out: flags.out,
    tokenEnv,
    only: readOnly(flags),
    skipAttachments: flags.skipAttachments,
  }
}
