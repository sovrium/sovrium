/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { ProcessEnv } from '@/application/ports/services/process-env'
import { httpOriginOf, isSameHttpOrigin } from '@/domain/kernel/url/credential-origin'
import { resolveBaseUrl } from '@/domain/models/app/connections/connection-base-url-service'
import { buildEnvLookup, resolveEnvInString } from '../resolve-env-vars'
import type { InjectedHeaders } from './auth-headers'
import type { ActionOutcome } from './shared'
import type { ProcessEnvShape } from '@/application/ports/services/process-env'
import type { App } from '@/domain/models/app'

/**
 * A connection's credential goes to its own service and nowhere else.
 *
 * An `http` or `webhook` step that names a connection sends the connection's
 * key or token only when the request goes to the origin of the connection's
 * `baseUrl` (resolved like `connection/call` resolves it: literal, `$env.VAR`
 * or `$token.FIELD`). Any other request fails before it is sent, so a URL that
 * run data chose, a typo, or a step pointed at the wrong service never hands
 * the credential to a site it was not declared for. The configuration refuses
 * the first two when it loads; this is the check at the moment of sending.
 */

interface BoundConnection {
  readonly name: string
  readonly baseUrl?: string | undefined
  readonly allowedOrigins?: readonly string[] | undefined
}

const findConnection = (app: App, name: string): BoundConnection | undefined =>
  ((app as { readonly connections?: readonly BoundConnection[] }).connections ?? []).find(
    (conn) => conn.name === name
  )

/**
 * Why the request to `requestUrl` may not carry `connectionName`'s credential,
 * as the step's failure, or `undefined` when it may: it goes to the origin of
 * the connection's `baseUrl` or to one of its `allowedOrigins`. `injected.env` is
 * the process environment a `$env.VAR` origin is read from, as {@link ProcessEnv}
 * holds it.
 */
export const credentialBindingRefusal = (
  app: App,
  connectionName: string,
  requestUrl: string,
  injected: Pick<InjectedHeaders, 'tokenFields'> & { readonly env: ProcessEnvShape }
): ActionOutcome | undefined => {
  const conn = findConnection(app, connectionName)
  if (conn === undefined) return undefined
  if (conn.baseUrl === undefined || conn.baseUrl === '') {
    return {
      status: 'failure',
      error: `Connection '${connectionName}' declares no baseUrl, so its credential is not sent; the request was not sent`,
    }
  }
  const envLookup = buildEnvLookup(app.env, injected.env)
  const base = resolveBaseUrl(envLookup, conn.baseUrl, injected.tokenFields)
  if (!base.ok) return { status: 'failure', error: `connection ${connectionName}: ${base.error}` }
  const allowed = [
    base.url,
    ...(conn.allowedOrigins ?? []).map((origin) => resolveEnvInString(origin, envLookup)),
  ]
  if (allowed.some((origin) => isSameHttpOrigin(requestUrl, origin))) return undefined
  const named = allowed.map((origin) => httpOriginOf(origin) ?? origin).join(', ')
  const target = httpOriginOf(requestUrl) ?? requestUrl
  return {
    status: 'failure',
    error: `Connection '${connectionName}' sends its credential only to ${named}; the request to ${target} was not sent`,
  }
}

/**
 * The request target when the credential may go there: `{ url, merged }`, or
 * the step's failure when it may not. A step naming no connection carries no
 * credential and is never refused here.
 */
export const boundTarget = <Merged extends Pick<InjectedHeaders, 'tokenFields'>>(
  app: App,
  connectionName: string | undefined,
  url: string,
  merged: Merged
): Effect.Effect<ActionOutcome | { readonly url: string; readonly merged: Merged }> =>
  Effect.gen(function* () {
    if (connectionName === undefined || connectionName === '') return { url, merged }
    const env = yield* ProcessEnv
    return credentialBindingRefusal(app, connectionName, url, { ...merged, env }) ?? { url, merged }
  }).pipe(Effect.withSpan('automations.bound-target'))
