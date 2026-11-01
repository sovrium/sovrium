/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where an `http` or `webhook` step may send a connection's credential, as far
 * as the configuration alone can tell.
 *
 * A connection's credential belongs to its service. A step that names one must
 * write the site it calls in the configuration (literally, or whole from
 * `$env.VAR`), so no value a caller or a record supplies can choose where the
 * credential goes; the connection must declare the `baseUrl` its credential is
 * bound to; and a site written literally must be the origin of that `baseUrl`
 * or one of the connection's `allowedOrigins`. The run checks the origin again
 * when it sends, for what only the run can resolve (`$env.`, `$token.`).
 *
 * Pure: no I/O; runs inside the AppSchema decode, after the reference check.
 */

import { hasConfigFixedHost, httpOriginOf } from '@/domain/kernel/url/credential-origin'

/** A connection as far as binding its credential goes. */
interface BindingConnection {
  readonly name: string
  readonly baseUrl?: string | undefined
  readonly allowedOrigins?: ReadonlyArray<string> | undefined
}

/** A step as far as binding goes: its type, and its props' url and connection. */
interface BindingStep {
  readonly type: string
  readonly props?: unknown
}

/** The step types that send a request to the url they name, with a connection's credential. */
const URL_SENDING_TYPES: ReadonlySet<string> = new Set(['http', 'webhook'])

/** A step's url and connection, when it is an http or webhook step naming a connection. */
const boundRequestOf = (
  step: BindingStep
): { readonly url: string; readonly connection: string } | undefined => {
  if (!URL_SENDING_TYPES.has(step.type)) return undefined
  const props = step.props as Readonly<Record<string, unknown>> | undefined
  const connection = props?.['connection']
  const url = props?.['url']
  if (typeof connection !== 'string' || connection === '' || typeof url !== 'string') {
    return undefined
  }
  return { url, connection }
}

/** The origin a URL written literally names, or `undefined` when a template or `$env.` is in it. */
const literalOriginOf = (url: string): string | undefined => {
  const text = url.trim()
  if (text.includes('$env.') || !hasConfigFixedHost(text)) return undefined
  return httpOriginOf(text)
}

/**
 * The origins the credential may go to, when every one of them is written
 * literally; `undefined` when one comes from the environment or the token,
 * which only the run can resolve.
 */
const literalAllowedOrigins = (conn: BindingConnection): readonly string[] | undefined => {
  const declared = [conn.baseUrl ?? '', ...(conn.allowedOrigins ?? [])]
  const origins = declared.map((entry) =>
    entry.startsWith('$') ? undefined : httpOriginOf(entry.trim())
  )
  return origins.every((origin) => origin !== undefined) ? (origins as string[]) : undefined
}

/**
 * Why `step` may not send its connection's credential where it points, as the
 * tail of the decode message after `Automation '<a>' action '<step>' `, or
 * `undefined` when it may (or the step names no connection, or the connection
 * is not declared: the reference check reports that).
 */
export const credentialBindingIssue = (
  step: BindingStep,
  connections: ReadonlyArray<BindingConnection> | undefined
): string | undefined => {
  const request = boundRequestOf(step)
  if (request === undefined) return undefined
  const conn = (connections ?? []).find((candidate) => candidate.name === request.connection)
  if (conn === undefined) return undefined
  if (!hasConfigFixedHost(request.url)) {
    return `sends the '${conn.name}' connection's credential to a URL whose host is not fixed in the config. Write the scheme and host literally or as $env.VAR, and put templates only in the path or query`
  }
  if (conn.baseUrl === undefined || conn.baseUrl === '') {
    return `uses connection '${conn.name}', which declares no baseUrl. A connection used by an http or webhook step must declare the baseUrl its credential is bound to`
  }
  const origin = literalOriginOf(request.url)
  const allowed = literalAllowedOrigins(conn)
  if (origin === undefined || allowed === undefined || allowed.includes(origin)) return undefined
  return `sends the '${conn.name}' connection's credential to ${origin}, which is neither the origin of its baseUrl nor one of its allowedOrigins`
}
