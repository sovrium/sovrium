/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { envReferencesIn } from '@/domain/models/app/env-reference-service'
import { resolveEnvInString } from '../resolve-env-vars'
import { stringProp, type UnconfiguredConnection } from './shared'

/**
 * Static (non-OAuth2) connection auth headers.
 *
 * Split out of `auth-headers.ts` because it shares nothing with the OAuth2
 * path: `apiKey` / `bearer` / `basic` build their header purely from the
 * connection's in-memory props, with no store, no scope, and no refresh. The
 * OAuth2 half of that file grew a second credential store (`app` scope) and
 * needed the room.
 */

/** The connection shape both auth paths read. */
export interface ConnectionDef {
  readonly name: string
  /** The connection's declared label, the name the console shows it under. */
  readonly label?: string | undefined
  readonly type: string
  readonly props: Record<string, unknown>
}

/** The answer to "can this connection authenticate a request?". */
export type StaticAuthHeader =
  | { readonly header: string; readonly value: string }
  /** An `apiKey` connection with `query`: the key rides in that query parameter, no header. */
  | { readonly query: string; readonly value: string }
  | { readonly unconfigured: UnconfiguredConnection }
  | { readonly error: string }

/**
 * The first `$env.` variable `raw` references that resolves to nothing — not
 * declared, or declared with neither a value in the environment nor a default.
 * `undefined` when every reference is set, or when `raw` references none (a
 * literal credential is never "unconfigured").
 */
export const unsetEnvReference = (
  raw: string,
  envLookup: Readonly<Record<string, string>>
): string | undefined => envReferencesIn(raw).find((name) => (envLookup[name] ?? '') === '')

/**
 * The skip reason a run records for an unconfigured connection. It names the
 * connection as the Connections page does — by its declared label, else by its
 * name — so the operator reading the run finds it on that page.
 */
export const unconfiguredConnectionReason = ({
  connection,
  label,
  variable,
}: UnconfiguredConnection): string =>
  `Connection "${label !== undefined && label !== '' ? label : connection}" is not configured: ${variable} is not set`

/** The secret-bearing props each static auth type reads its credential from. */
const credentialPropsOf = (type: string): readonly string[] => {
  if (type === 'apiKey') return ['key']
  if (type === 'bearer') return ['token']
  if (type === 'basic') return ['username', 'password']
  return []
}

/**
 * Build the static auth header (apiKey/basic/bearer) from a connection's
 * in-memory props.
 *
 * Secret-bearing props (`key`, `token`, `username`, `password`) are documented
 * as "supports $env.VAR" in the connection prop schemas
 * (`src/domain/models/app/connections/props.ts`). Because connection
 * definitions are read straight off `app.connections[]` (never run through the
 * upstream action-prop env substitution), a connection declaring
 * `key: '$env.MY_TOKEN'` would otherwise send the LITERAL `$env.MY_TOKEN`
 * string on the wire. We resolve `$env.` on those props here, against the
 * supplied env lookup (built from `app.env` + `process.env`). Non-secret
 * identifier props (`prefix`, `header`) are plain config and pass through
 * untouched — mirroring `resolveEnvRef` in
 * `src/infrastructure/webhooks/auth-headers.ts`.
 *
 * A credential prop referencing a variable that resolves to nothing answers
 * the `unconfigured` arm instead of an error: only an env-sourced credential
 * qualifies, so a literal value that is empty or refused stays a failure.
 */
export const buildStaticAuthHeader = (
  conn: ConnectionDef,
  envLookup: Readonly<Record<string, string>>
): StaticAuthHeader => {
  // A credential sourced from a variable that is not set is checked FIRST, so
  // it is reported as unconfigured rather than as an empty credential.
  const unset = credentialPropsOf(conn.type)
    .map((key) => unsetEnvReference(stringProp(conn.props, key), envLookup))
    .find((variable) => variable !== undefined)
  return unset === undefined
    ? buildCredentialHeader(conn, envLookup)
    : {
        unconfigured: {
          connection: conn.name,
          ...(conn.label !== undefined ? { label: conn.label } : {}),
          variable: unset,
        },
      }
}

/** Where an `apiKey` connection sends its key: the query parameter it names, else its header. */
const apiKeyPlacement = (
  props: Readonly<Record<string, unknown>>,
  key: string
): StaticAuthHeader => {
  const query = stringProp(props, 'query')
  if (query) return { query, value: key }
  const headerName = stringProp(props, 'header') || 'X-API-Key'
  const prefix = stringProp(props, 'prefix')
  return { header: headerName, value: prefix ? `${prefix} ${key}` : key }
}

/** The header a static connection's credential builds, or why it cannot. */
const buildCredentialHeader = (
  conn: ConnectionDef,
  envLookup: Readonly<Record<string, string>>
): StaticAuthHeader => {
  const { props } = conn
  const secretProp = (key: string): string => resolveEnvInString(stringProp(props, key), envLookup)
  if (conn.type === 'apiKey') {
    const key = secretProp('key')
    if (!key) return { error: `connection ${conn.name}: apiKey requires a key` }
    return apiKeyPlacement(props, key)
  }
  if (conn.type === 'bearer') {
    const token = secretProp('token')
    if (!token) return { error: `connection ${conn.name}: bearer requires a token` }
    return { header: 'Authorization', value: `Bearer ${token}` }
  }
  if (conn.type === 'basic') {
    const username = secretProp('username')
    const password = secretProp('password')
    // An empty username is valid when a password is set: APIs that take their
    // key as the Basic password (`:apikey`) expect exactly that. Both empty
    // would send a bare `:`, which authenticates nothing — refuse it instead.
    if (!username && !password) {
      return { error: `connection ${conn.name}: basic requires a username or a password` }
    }
    const encoded = Buffer.from(`${username}:${password}`, 'utf8').toString('base64')
    return { header: 'Authorization', value: `Basic ${encoded}` }
  }
  return { error: `connection ${conn.name}: unsupported type ${conn.type}` }
}
