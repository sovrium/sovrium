/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Reading `app.connections[]` — the config half of a connection.
 *
 * A connection is two things kept deliberately apart: a DEFINITION in the app
 * config (client id, scopes, URLs, PKCE method, and the shared client secret),
 * and per-user TOKENS in `system.connection_tokens`, encrypted at rest. Only the
 * definition lives here, and it is read from memory on every request rather than
 * persisted, which is why `system.connections.credentials` is written as `{}`:
 * duplicating a secret to disk buys no read-path benefit (audit H2).
 *
 * `props` stays an open bag. The per-type prop schemas (`oauth2`, `apiKey`,
 * `bearer`, `basic`) are decoded where they are USED, and a caller that needs
 * one narrows it there — an application module that decoded every shape would
 * have to know about all of them to answer a question about one.
 */

import type { App } from '@/domain/models/app'

/** One entry of `app.connections[]`, as the config declares it. */
export interface ConnectionDef {
  readonly name: string
  readonly type: string
  readonly props: Record<string, unknown>
}

/** The connection the config declares under `name`, if it declares one. */
export const findConnection = (app: App, name: string): ConnectionDef | undefined => {
  const list = (app as { connections?: readonly ConnectionDef[] }).connections ?? []
  return list.find((conn) => conn.name === name)
}

/**
 * A connection's effective token scope.
 *
 * `app` (the default) means ONE shared credential an admin manages; `user` opts
 * the connection into per-user tokens any signed-in user may hold. The default
 * matters: it is what makes an undeclared scope admin-managed rather than
 * silently per-user.
 */
export const effectiveScope = (props: { readonly scope?: 'app' | 'user' }): 'app' | 'user' =>
  props.scope ?? 'app'
