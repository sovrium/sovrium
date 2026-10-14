/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parsePositiveIntEnv } from './positive-int-env'

/**
 * The external MCP servers this instance's agents may call, as the operator
 * declares them in the environment (MCP client mode).
 *
 * An address and a credential are deployment facts, so they live here and
 * never in the app schema; an agent only NAMES the servers it may reach
 * (`agents[].mcp.servers`).
 *
 * Env vars:
 *   MCP_CLIENT_SERVERS       comma-separated `name=url` entries. A bare URL is
 *                            named by its 1-based position: `server-1`, …
 *   MCP_CLIENT_TIMEOUT       per-request timeout in ms (default 10000)
 *   MCP_AUTH_TYPE_{NAME}     bearer | header | none (default none)
 *   MCP_AUTH_TOKEN_{NAME}    the service credential
 *   MCP_AUTH_HEADER_{NAME}   the header carrying it, when the type is header
 *
 * `{NAME}` is the server name upper-cased with hyphens as underscores
 * (`registry-fr` → `MCP_AUTH_TOKEN_REGISTRY_FR`). Keyed by name, a credential
 * cannot follow a reordering of the list to another server — which the former
 * positional `MCP_AUTH_TOKEN_1` did. Those positional names are refused rather
 * than ignored: silently dropping them would send no credential at all while
 * the operator believes one is set.
 */

/** Authentication strategy for one external MCP server. */
export type McpClientAuthType = 'bearer' | 'header' | 'none'

/** One declared external MCP server. */
export interface McpClientServerConfig {
  readonly name: string
  readonly url: string
  readonly authType: McpClientAuthType
  /** The header carrying the credential, when `authType` is `header`. */
  readonly headerName?: string
  /** The credential. Never serialised, never logged. */
  readonly token?: string
}

/** The whole client-mode configuration. */
export interface McpClientEnvConfig {
  readonly servers: readonly McpClientServerConfig[]
  readonly timeoutMs: number
}

export type McpClientEnvResult =
  | { readonly ok: true; readonly config: McpClientEnvConfig }
  | { readonly ok: false; readonly error: string }

/** Default of `MCP_CLIENT_TIMEOUT`, in milliseconds. */
export const MCP_CLIENT_DEFAULT_TIMEOUT_MS = 10_000

const SERVER_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/
const NAMED_ENTRY = /^([^=/:]+)=(.+)$/
const BARE_URL = /^https?:\/\//i
const POSITIONAL_AUTH_VAR = /^MCP_AUTH_(TYPE|TOKEN|HEADER)_\d+$/
/** RFC 7230 token characters: what a header name may contain. */
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/

/** The `{NAME}` suffix of a server's auth variables. */
export const mcpServerEnvSuffix = (name: string): string => name.toUpperCase().replace(/-/g, '_')

type Parsed<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string }

const fail = <T>(error: string): Parsed<T> => ({ ok: false, error })

interface Entry {
  readonly name: string
  readonly url: string
}

const parseEntry = (raw: string, position: number): Parsed<Entry> => {
  if (BARE_URL.test(raw)) return { ok: true, value: { name: `server-${position}`, url: raw } }
  const match = NAMED_ENTRY.exec(raw)
  if (match === null) {
    return fail(
      `MCP_CLIENT_SERVERS entry ${position} is neither "name=url" nor an http(s) URL. Write it as "registry=https://registry.example.com/mcp".`
    )
  }
  const name = (match[1] ?? '').trim()
  const url = (match[2] ?? '').trim()
  if (!SERVER_NAME.test(name)) {
    return fail(
      `MCP_CLIENT_SERVERS names a server ${JSON.stringify(name)}: a server name is lowercase kebab-case (letters, digits and single hyphens — e.g. "registry").`
    )
  }
  return { ok: true, value: { name, url } }
}

const isHttpUrl = (raw: string): boolean => {
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const nonEmpty = (value: string | undefined): string | undefined =>
  value === undefined || value.trim() === '' ? undefined : value.trim()

interface AuthVars {
  readonly suffix: string
  readonly type: string
  readonly token: string | undefined
  readonly headerName: string | undefined
}

/** Why a server's auth variables do not fit together, or `undefined`. */
const authError = (entry: Entry, vars: AuthVars): string | undefined => {
  const { suffix, type, token, headerName } = vars
  if (type !== 'bearer' && type !== 'header' && type !== 'none') {
    return `MCP_AUTH_TYPE_${suffix} is ${JSON.stringify(type)}; it must be bearer, header or none.`
  }
  if (type !== 'none' && token === undefined) {
    return `MCP_AUTH_TYPE_${suffix} is ${type} but MCP_AUTH_TOKEN_${suffix} is unset, so the server "${entry.name}" would be called with no credential.`
  }
  const headerMissing = headerName === undefined || !HEADER_NAME.test(headerName)
  return type === 'header' && headerMissing
    ? `MCP_AUTH_TYPE_${suffix} is header, so MCP_AUTH_HEADER_${suffix} must name the header that carries the credential (e.g. X-Api-Key).`
    : undefined
}

const parseAuth = (
  entry: Entry,
  env: Readonly<Record<string, string | undefined>>
): Parsed<McpClientServerConfig> => {
  const suffix = mcpServerEnvSuffix(entry.name)
  const vars: AuthVars = {
    suffix,
    type: nonEmpty(env[`MCP_AUTH_TYPE_${suffix}`]) ?? 'none',
    token: nonEmpty(env[`MCP_AUTH_TOKEN_${suffix}`]),
    headerName: nonEmpty(env[`MCP_AUTH_HEADER_${suffix}`]),
  }
  const error = authError(entry, vars)
  if (error !== undefined) return fail(error)
  const authType = vars.type as McpClientAuthType
  return {
    ok: true,
    value: {
      name: entry.name,
      url: entry.url,
      authType,
      ...(authType === 'header' &&
        vars.headerName !== undefined && { headerName: vars.headerName }),
      ...(authType !== 'none' && vars.token !== undefined && { token: vars.token }),
    },
  }
}

const firstError = <T>(results: readonly Parsed<T>[]): string | undefined =>
  results.find((result): result is { readonly ok: false; readonly error: string } => !result.ok)
    ?.error

const values = <T>(results: readonly Parsed<T>[]): readonly T[] =>
  results.flatMap((result) => (result.ok ? [result.value] : []))

const entriesError = (entries: readonly Entry[]): string | undefined => {
  const names = entries.map((entry) => entry.name)
  const duplicate = names.find((name, index) => names.indexOf(name) !== index)
  if (duplicate !== undefined) {
    return `MCP_CLIENT_SERVERS declares the server "${duplicate}" twice; every server needs its own name.`
  }
  const badUrl = entries.find((entry) => !isHttpUrl(entry.url))
  return badUrl === undefined
    ? undefined
    : `MCP_CLIENT_SERVERS gives the server "${badUrl.name}" an address that is not an http(s) URL.`
}

const positionalVarsError = (
  env: Readonly<Record<string, string | undefined>>
): string | undefined => {
  const stale = [
    ...Object.keys(env).filter(
      (key) => POSITIONAL_AUTH_VAR.test(key) && nonEmpty(env[key]) !== undefined
    ),
  ].toSorted()
  if (stale.length === 0) return undefined
  return `${stale.join(', ')} ${stale.length === 1 ? 'is' : 'are'} set, but MCP server credentials are now keyed by server NAME, not by position: MCP_AUTH_TOKEN_1 becomes MCP_AUTH_TOKEN_SERVER_1 for a bare URL, or MCP_AUTH_TOKEN_REGISTRY for "registry=https://…". Rename them; a credential keyed by position follows a reordering of the list to another server.`
}

const parseTimeout = (raw: string | undefined): Parsed<number> => {
  if (nonEmpty(raw) === undefined) return { ok: true, value: MCP_CLIENT_DEFAULT_TIMEOUT_MS }
  const value = parsePositiveIntEnv(raw)
  return value === undefined
    ? fail(
        `MCP_CLIENT_TIMEOUT is ${JSON.stringify(raw)}; it must be a positive number of milliseconds.`
      )
    : { ok: true, value }
}

/**
 * Read client mode from the environment. An unset or empty
 * `MCP_CLIENT_SERVERS` is client mode OFF: `{ ok: true, config.servers: [] }`.
 * Every malformed value is an error naming the variable, for the boot to refuse.
 */
export const parseMcpClientEnv = (
  env: Readonly<Record<string, string | undefined>>
): McpClientEnvResult => {
  const timeout = parseTimeout(env['MCP_CLIENT_TIMEOUT'])
  if (!timeout.ok) return timeout
  const raw = nonEmpty(env['MCP_CLIENT_SERVERS'])
  if (raw === undefined) return { ok: true, config: { servers: [], timeoutMs: timeout.value } }
  const positional = positionalVarsError(env)
  if (positional !== undefined) return { ok: false, error: positional }
  const parsedEntries = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry, index) => parseEntry(entry, index + 1))
  const entryError = firstError(parsedEntries) ?? entriesError(values(parsedEntries))
  if (entryError !== undefined) return { ok: false, error: entryError }
  const servers = values(parsedEntries).map((entry) => parseAuth(entry, env))
  const authError = firstError(servers)
  return authError === undefined
    ? { ok: true, config: { servers: values(servers), timeoutMs: timeout.value } }
    : { ok: false, error: authError }
}

/**
 * Why the app's agents cannot boot against the declared servers, or
 * `undefined`. An agent naming a server the environment does not declare stops
 * the boot, naming both — a silently missing server would read as an agent
 * that chose not to use its tools.
 */
export const undeclaredAgentMcpServers = (
  agents: readonly {
    readonly name: string
    readonly mcp?: { readonly servers?: readonly string[] }
  }[],
  servers: readonly Pick<McpClientServerConfig, 'name'>[]
): string | undefined => {
  const declared = new Set(servers.map((server) => server.name))
  const missing = agents.flatMap((agent) =>
    (agent.mcp?.servers ?? [])
      .filter((name) => !declared.has(name))
      .map((name) => `agent "${agent.name}" names the MCP server "${name}"`)
  )
  if (missing.length === 0) return undefined
  const known = servers.length === 0 ? 'none' : servers.map((server) => server.name).join(', ')
  return `${missing.join('; ')}, which MCP_CLIENT_SERVERS does not declare (declared: ${known}). Declare it as "name=url" in MCP_CLIENT_SERVERS, or remove it from mcp.servers.`
}
