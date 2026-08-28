/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveEnvInString } from '../resolve-env-vars'
import { stringProp } from './shared'

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
  readonly type: string
  readonly props: Record<string, unknown>
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
 */
export const buildStaticAuthHeader = (
  conn: ConnectionDef,
  envLookup: Readonly<Record<string, string>>
): { readonly header: string; readonly value: string } | { readonly error: string } => {
  const { props } = conn
  const secretProp = (key: string): string => resolveEnvInString(stringProp(props, key), envLookup)
  if (conn.type === 'apiKey') {
    const key = secretProp('key')
    if (!key) return { error: `connection ${conn.name}: apiKey requires a key` }
    const headerName = stringProp(props, 'header') || 'X-API-Key'
    const prefix = stringProp(props, 'prefix')
    return { header: headerName, value: prefix ? `${prefix} ${key}` : key }
  }
  if (conn.type === 'bearer') {
    const token = secretProp('token')
    if (!token) return { error: `connection ${conn.name}: bearer requires a token` }
    return { header: 'Authorization', value: `Bearer ${token}` }
  }
  if (conn.type === 'basic') {
    const username = secretProp('username')
    const password = secretProp('password')
    if (!username) return { error: `connection ${conn.name}: basic requires a username` }
    const encoded = Buffer.from(`${username}:${password}`, 'utf8').toString('base64')
    return { header: 'Authorization', value: `Basic ${encoded}` }
  }
  return { error: `connection ${conn.name}: unsupported type ${conn.type}` }
}
