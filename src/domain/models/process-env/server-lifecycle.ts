/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * How a server binds and lives under a supervisor.
 *
 * A developer machine and a supervised host want opposite things from the same
 * situation, and every variable here exists to tell them apart:
 *
 * - `SOVRIUM_STRICT_PORT` — a busy port refuses the boot instead of falling
 *   back to an OS-assigned one. Implied by a non-empty `PORT` and by systemd's
 *   `INVOCATION_ID`, so a unit file is strict without saying so.
 * - `SOVRIUM_BIND_HOST` — the interface to bind. It replaces `HOSTNAME`, a name
 *   bash sets for every interactive shell and Docker exports as the container
 *   id, which moved servers onto addresses nobody chose.
 * - `SOVRIUM_LISTEN_UNIX` — serve HTTP on a Unix socket instead of a TCP port,
 *   for a socket-activation proxy in front. There is one listener, so it
 *   refuses to share the boot with a `PORT`.
 * - `SOVRIUM_IDLE_EXIT_SECONDS` — exit cleanly once idle that long, so the
 *   proxy can start the app again on the next connection.
 * - `SOVRIUM_LOG_FORMAT` — `text` (the default) or `json`, one object per line
 *   for a log collector.
 *
 * Plain functions over a `process.env`-shaped record, like their siblings in
 * this directory: a parser throws an `Error` naming the variable and the value,
 * and the boot gate (`validate-boot-environment.ts`) turns that into a refusal
 * before anything binds. A resolver never throws — it runs after the gate.
 */

/** A read-only `process.env`-shaped map, the only input this module reads. */
type EnvRecord = Readonly<Record<string, string | undefined>>

/** The strict-port opt-in. */
export const SOVRIUM_STRICT_PORT_VAR = 'SOVRIUM_STRICT_PORT'

/** The interface to bind. */
export const SOVRIUM_BIND_HOST_VAR = 'SOVRIUM_BIND_HOST'

/** The Unix-socket listener. */
export const SOVRIUM_LISTEN_UNIX_VAR = 'SOVRIUM_LISTEN_UNIX'

/** The idle window after which a server exits by itself. */
export const SOVRIUM_IDLE_EXIT_SECONDS_VAR = 'SOVRIUM_IDLE_EXIT_SECONDS'

/** The shortest idle window accepted: anything shorter restarts the app between visits. */
export const MIN_IDLE_EXIT_SECONDS = 30

/** The shape of every line the server writes. */
export const SOVRIUM_LOG_FORMAT_VAR = 'SOVRIUM_LOG_FORMAT'

/** The bind host when nothing names one. */
export const DEFAULT_BIND_HOST = 'localhost'

/**
 * The raw shape of the variables, for documentation and tooling. The parsers
 * below are what the boot actually applies.
 */
export const ServerLifecycleEnvSchema = Schema.Struct({
  bindHost: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Network interface to bind (SOVRIUM_BIND_HOST): localhost or an IP literal such as 127.0.0.1, 0.0.0.0 or ::',
        examples: ['0.0.0.0'],
      })
    )
  ),
  listenUnix: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Path of a Unix socket to serve HTTP on instead of a TCP port (SOVRIUM_LISTEN_UNIX); refused alongside PORT',
        examples: ['/run/sovrium/app.sock'],
      })
    )
  ),
  idleExitSeconds: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Exit cleanly after this many idle seconds, at least 30 (SOVRIUM_IDLE_EXIT_SECONDS)',
        examples: ['900'],
      })
    )
  ),
  logFormat: Schema.optional(
    Schema.Literals(['text', 'json']).pipe(
      Schema.annotate({
        description: 'Shape of every line the server writes (SOVRIUM_LOG_FORMAT): text or json',
        examples: ['json'],
      })
    )
  ),
  strictPort: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Refuse to start on a busy port instead of falling back to a free one (SOVRIUM_STRICT_PORT): 1 or true',
        examples: ['1'],
      })
    )
  ),
})

/** Trim a value and treat empty (or unset) as "not provided". */
const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? undefined : trimmed
}

/**
 * Resolve `SOVRIUM_STRICT_PORT` for the boot gate: `1` or `true` (any case) is
 * on; unset, empty, `0` or `false` is off.
 *
 * @throws Error naming the variable and the value for anything else, so a
 *   `yes` meant as "on" is found at the first boot rather than at the first
 *   port conflict.
 */
export const parseSovriumStrictPort = (env: EnvRecord = process.env): boolean => {
  const raw = clean(env[SOVRIUM_STRICT_PORT_VAR])
  if (raw === undefined || /^(?:0|false)$/i.test(raw)) return false
  if (/^(?:1|true)$/i.test(raw)) return true
  // eslint-disable-next-line functional/no-throw-statements -- a boot-time refusal: the caller turns it into a startup failure before the port binds.
  throw new Error(
    `${SOVRIUM_STRICT_PORT_VAR} must be 1 or true, or unset; "${raw}" is not accepted.`
  )
}

/**
 * Whether a busy port must refuse the boot rather than fall back to an
 * OS-assigned port.
 *
 * The port was chosen on purpose when `PORT` is non-empty, when the operator
 * said so with `SOVRIUM_STRICT_PORT`, or when the process runs under systemd —
 * which exports `INVOCATION_ID` to every unit it starts. Only an unset `PORT`
 * with none of those keeps the development fallback, where two apps started by
 * hand side by side should both just run. Never throws: an unparseable
 * `SOVRIUM_STRICT_PORT` was already refused at boot, and reads as off here.
 */
export const isStrictPortBoot = (env: EnvRecord = process.env): boolean =>
  clean(env['PORT']) !== undefined ||
  /^(?:1|true)$/i.test(clean(env[SOVRIUM_STRICT_PORT_VAR]) ?? '') ||
  clean(env['INVOCATION_ID']) !== undefined

/** An IPv4 dotted quad with every octet in range. */
const isIpv4Literal = (value: string): boolean => {
  const octets = value.split('.')
  return (
    octets.length === 4 && octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)
  )
}

/** An IPv6 literal, bare or in brackets, as a URL host would accept it. */
const isIpv6Literal = (value: string): boolean => {
  const bare = value.replace(/^\[(.*)\]$/, '$1')
  if (!bare.includes(':') || !/^[0-9a-f:.]+$/i.test(bare)) return false
  try {
    return new URL(`http://[${bare}]/`).hostname !== ''
  } catch {
    return false
  }
}

/** Whether a bind host is one `SOVRIUM_BIND_HOST` accepts: `localhost` or an IP literal. */
export const isAcceptedBindHost = (value: string): boolean =>
  value.toLowerCase() === DEFAULT_BIND_HOST || isIpv4Literal(value) || isIpv6Literal(value)

/**
 * Resolve `SOVRIUM_BIND_HOST` for the boot gate: unset or empty is `undefined`,
 * `localhost` or an IP literal is that value, brackets removed.
 *
 * @throws Error naming the variable and the value for anything else — a machine
 *   name pasted from `hostname` above all, which binds wherever that name
 *   happens to resolve, if it resolves at all.
 */
export const parseSovriumBindHost = (env: EnvRecord = process.env): string | undefined => {
  const raw = clean(env[SOVRIUM_BIND_HOST_VAR])
  if (raw === undefined) return undefined
  if (isAcceptedBindHost(raw)) return raw.replace(/^\[(.*)\]$/, '$1')
  // eslint-disable-next-line functional/no-throw-statements -- a boot-time refusal: the caller turns it into a startup failure before the port binds.
  throw new Error(
    `${SOVRIUM_BIND_HOST_VAR} must be localhost or an IP address such as 127.0.0.1, 0.0.0.0 or ::; "${raw}" is not one.`
  )
}

/** The interface a server binds, and whether it came from the deprecated `HOSTNAME`. */
export interface BindHost {
  readonly host: string
  readonly fromDeprecatedHostname: boolean
}

/**
 * The interface to bind: `SOVRIUM_BIND_HOST`, else `HOSTNAME` — honoured for
 * the deployments that already set it, and flagged so the boot can say once
 * that it is deprecated — else `localhost`. Never throws: an invalid
 * `SOVRIUM_BIND_HOST` was already refused at boot.
 */
export const resolveBindHost = (env: EnvRecord = process.env): BindHost => {
  const declared = clean(env[SOVRIUM_BIND_HOST_VAR])
  if (declared !== undefined) {
    return { host: declared.replace(/^\[(.*)\]$/, '$1'), fromDeprecatedHostname: false }
  }
  const legacy = clean(env['HOSTNAME'])
  if (legacy !== undefined) return { host: legacy, fromDeprecatedHostname: true }
  return { host: DEFAULT_BIND_HOST, fromDeprecatedHostname: false }
}

/** The one line a boot prints when it binds from `HOSTNAME`. */
export const deprecatedHostnameNotice = (host: string): string =>
  `[server] HOSTNAME is deprecated as the bind address; set ${SOVRIUM_BIND_HOST_VAR}=${host} instead. HOSTNAME is read only while ${SOVRIUM_BIND_HOST_VAR} is unset.`

/**
 * Resolve `SOVRIUM_LISTEN_UNIX` for the boot gate: unset or empty is
 * `undefined`, otherwise the socket path.
 *
 * @throws Error naming both variables when a non-empty `PORT` is set too: a
 *   server has one listener, and picking either silently would leave the
 *   proxy that expected the other pointing at nothing.
 */
export const parseSovriumListenUnix = (env: EnvRecord = process.env): string | undefined => {
  const path = clean(env[SOVRIUM_LISTEN_UNIX_VAR])
  if (path === undefined) return undefined
  if (clean(env['PORT']) !== undefined) {
    // eslint-disable-next-line functional/no-throw-statements -- a boot-time refusal: the caller turns it into a startup failure before the port binds.
    throw new Error(
      `${SOVRIUM_LISTEN_UNIX_VAR} and PORT are both set; a server has one listener. Unset PORT to serve on the socket, or ${SOVRIUM_LISTEN_UNIX_VAR} to serve on the port.`
    )
  }
  return path
}

/** The socket path to listen on, or `undefined` for a TCP port. Never throws. */
export const resolveListenUnix = (env: EnvRecord = process.env): string | undefined =>
  clean(env[SOVRIUM_LISTEN_UNIX_VAR])

/**
 * Resolve `SOVRIUM_IDLE_EXIT_SECONDS` for the boot gate: unset or empty is
 * `undefined` (never exit), otherwise a whole number of seconds.
 *
 * @throws Error naming the variable, the floor and the value for anything that
 *   is not a whole number of at least {@link MIN_IDLE_EXIT_SECONDS}.
 */
export const parseSovriumIdleExitSeconds = (env: EnvRecord = process.env): number | undefined => {
  const raw = clean(env[SOVRIUM_IDLE_EXIT_SECONDS_VAR])
  if (raw === undefined) return undefined
  const seconds = /^\d+$/.test(raw) ? Number(raw) : Number.NaN
  if (Number.isSafeInteger(seconds) && seconds >= MIN_IDLE_EXIT_SECONDS) return seconds
  // eslint-disable-next-line functional/no-throw-statements -- a boot-time refusal: the caller turns it into a startup failure before the port binds.
  throw new Error(
    `${SOVRIUM_IDLE_EXIT_SECONDS_VAR} must be a whole number of seconds of at least ${String(MIN_IDLE_EXIT_SECONDS)}; "${raw}" is not one.`
  )
}

/** The idle window in seconds, or `undefined` when the server never exits on its own. Never throws. */
export const resolveIdleExitSeconds = (env: EnvRecord = process.env): number | undefined => {
  try {
    return parseSovriumIdleExitSeconds(env)
  } catch {
    return undefined
  }
}

/**
 * Resolve `SOVRIUM_LOG_FORMAT` for the boot gate: unset or empty is `text`.
 *
 * @throws Error naming the variable, the accepted values and the value for
 *   anything but `text` or `json` — a collector expecting JSON would otherwise
 *   receive text it cannot read, without a word.
 */
export const parseSovriumLogFormat = (env: EnvRecord = process.env): 'text' | 'json' => {
  const raw = clean(env[SOVRIUM_LOG_FORMAT_VAR])
  if (raw === undefined || raw === 'text') return 'text'
  if (raw === 'json') return 'json'
  // eslint-disable-next-line functional/no-throw-statements -- a boot-time refusal: the caller turns it into a startup failure before the port binds.
  throw new Error(`${SOVRIUM_LOG_FORMAT_VAR} must be text or json; "${raw}" is not accepted.`)
}

/** The log format, `text` for an unset or refused value. Never throws. */
export const resolveSovriumLogFormat = (env: EnvRecord = process.env): 'text' | 'json' =>
  clean(env[SOVRIUM_LOG_FORMAT_VAR]) === 'json' ? 'json' : 'text'
