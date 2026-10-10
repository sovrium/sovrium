/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { ConnectionRepository } from '@/application/ports/repositories/connections/connection-repository'
import { logError } from '@/infrastructure/logging/logger'
import { buildEnvLookup, resolveEnvInValue } from '../resolve-env-vars'
import { resolveAppScopedToken, resolveUserScopedToken } from './connection-token-lookup'
import { connectionScope } from './connection-token-refresh'
import { buildStaticAuthHeader, type ConnectionDef } from './static-auth-header'
import { resolveTokenExchangeHeader } from './token-exchange-token'
import type { ConnectionServices, RefreshOutcome } from './connection-token-refresh'
import type { AutomationContext } from './shared'
import type { App } from '@/domain/models/app'

/**
 * Auth header injection for connection-bound HTTP requests.
 *
 * Static auth types (apiKey, basic, bearer) build their header purely from
 * the connection's in-memory props. OAuth2 connections require a DB lookup
 * keyed on the running automation's userId — cross-user token theft via a
 * shared automation is prevented because the token row is scoped by
 * `(connection_id, user_id)`.
 *
 * Public surface: `resolveConnectionHeaders`. Everything else is internal
 * scaffolding kept module-local.
 */

const findConnection = (app: App, name: string): ConnectionDef | undefined => {
  const list = (app as { connections?: readonly ConnectionDef[] }).connections ?? []
  return list.find((conn) => conn.name === name)
}

/**
 * Look a connection row up, keeping "the store failed" distinct from "there is
 * no such row".
 *
 * Collapsing both to `undefined` (`Effect.catch(() => Effect.void)`) would
 * report a database outage to the operator as `not yet authorized` or
 * `was the connection deleted?` — an instruction to go and re-authorize a
 * connection that is fine, while the actual fault left no trace anywhere. Both
 * are a REFUSAL (an action failing is not a server error), but the refusal says
 * which of the two happened, and the cause is logged.
 *
 * `ok: false` carries the refusal wording so both callers phrase a lookup
 * failure identically; `ok: true` with `row: undefined` is a genuine miss.
 */
const lookupConnectionRow = (name: string) =>
  Effect.gen(function* () {
    const connRepo = yield* ConnectionRepository
    const outcome = yield* Effect.result(connRepo.findByName(name))
    if (outcome._tag === 'Success') return { ok: true, row: outcome.success } as const
    logError('Connection lookup failed while resolving automation auth headers', outcome.failure, {
      'sovrium.connection.name': name,
    })
    const reason = `connection ${name}: lookup failed (the connection store could not be read)`
    return { ok: false, reason } as const
  })

/**
 * The oauth2 connection with every `$env.VAR` in its props resolved against
 * the app's declared env vars and the OS environment — the client id, the
 * client secret, the token URL and the rest. Connection definitions are read
 * straight off `app.connections[]`, never through the action-prop env pass, so
 * without this a client-credentials grant, a refresh or a long-lived renewal
 * would send the literal `$env.` placeholder to the token endpoint. Resolved
 * here, once, every token path below sees real values; the grant fingerprint
 * therefore hashes the RESOLVED configuration, so rotating a secret in the
 * environment makes the next call ask for a new token, as rotating it in the
 * config does. Nothing here is logged.
 */
const withResolvedEnv = (app: App, conn: ConnectionDef): ConnectionDef => ({
  ...conn,
  props: resolveEnvInValue(conn.props, buildEnvLookup(app.env, process.env)) as Record<
    string,
    unknown
  >,
})

const resolveOAuth2AccessToken = (
  conn: ConnectionDef,
  automation: AutomationContext
): Effect.Effect<RefreshOutcome, never, ConnectionServices> =>
  Effect.gen(function* () {
    const scope = connectionScope(conn, automation)
    // `user` scope keeps refusing, and keeps refusing in the same words. A
    // per-user credential genuinely cannot be chosen when there is no user,
    // and picking someone's token arbitrarily is the privilege confusion this
    // whole feature exists to avoid. The guard stays FIRST on this branch so
    // the message is reached before any lookup can change it.
    if (scope.kind === 'user' && automation.userId === undefined) {
      return {
        ok: false,
        reason: `connection ${conn.name}: no user context (cron/system trigger)`,
      } as const
    }
    const lookup = yield* lookupConnectionRow(conn.name)
    if (!lookup.ok) return lookup
    const { row } = lookup
    if (row === undefined) {
      return {
        ok: false,
        reason: `connection ${conn.name}: not yet authorized (no system.connections row)`,
      } as const
    }
    const connectionId = String(row['id'])
    return yield* scope.kind === 'app'
      ? resolveAppScopedToken(conn, connectionId)
      : resolveUserScopedToken(conn, connectionId, scope.userId)
  })

export interface InjectedHeaders {
  readonly headers: Record<string, string>
  readonly error?: string
  /**
   * OAuth2 only: the extra fields the provider returned with the stored token
   * and the connection keeps (`props.tokenFields`), e.g. Salesforce's
   * `instance_url`. Read by `connection/call` to resolve a `$token.FIELD` base URL.
   */
  readonly tokenFields?: Readonly<Record<string, string>>
}

/**
 * Verify that a connection's `system.connections` row still exists at
 * runtime. The startup seeder (`runSeedAllConnectionDefinitions`)
 * upserts a row for every connection in `app.connections[]`; this
 * lookup catches the "deleted out from under us" case
 * where an operator removes the row
 * directly via SQL or the management UI. The error message names the
 * connection so the caller sees `will-be-removed` (or whatever the
 * connection is called) rather than a generic "connection error".
 *
 * Returns `undefined` on success, a refusal-reason string on failure.
 * Both the DB-error and the not-found branch surface as a refusal — an action
 * failing is not a server error — but they do not surface as the SAME
 * refusal: telling an operator the connection was deleted when the store simply
 * could not be read sends them to fix the wrong thing.
 */
const ensureConnectionExistsInDb = (
  connectionName: string
): Effect.Effect<string | undefined, never, ConnectionRepository> =>
  Effect.gen(function* () {
    const lookup = yield* lookupConnectionRow(connectionName)
    if (!lookup.ok) return lookup.reason
    if (lookup.row === undefined) {
      return `connection ${connectionName}: not found at runtime (was the connection deleted?)`
    }
    return undefined
  })

/**
 * Resolve the connection (if any) referenced by `props.connection`,
 * compute the auth header for the appropriate auth type, and merge it
 * into the request's headers. Static auth types (apiKey, basic, bearer)
 * are pure; oauth2 yields a DB lookup using `automation.userId`.
 *
 * Both static and oauth2 paths verify the connection's
 * `system.connections` row exists at runtime — startup seeds the row
 * for every connection in `app.connections[]`, so a missing row means
 * the connection was deleted between server start and trigger fire
 * For oauth2 the existence check is
 * inlined in `resolveOAuth2AccessToken` (it already does
 * findByName); for static types we do an explicit lookup before
 * building the header so the error surfaces with the connection name.
 *
 * Returns the merged headers OR a clear error string for the handler
 * to surface as an action failure.
 */
export const resolveConnectionHeaders = (
  app: App,
  automation: AutomationContext,
  baseHeaders: Readonly<Record<string, string>>,
  connectionName: string
): Effect.Effect<InjectedHeaders, never, ConnectionServices> =>
  Effect.gen(function* () {
    const conn = findConnection(app, connectionName)
    if (conn === undefined) {
      return {
        headers: baseHeaders,
        error: `connection ${connectionName}: not found in app config`,
      }
    }
    if (conn.type === 'oauth2') {
      const result = yield* resolveOAuth2AccessToken(withResolvedEnv(app, conn), automation)
      if (!result.ok) return { headers: baseHeaders, error: result.reason }
      const headers = { ...baseHeaders, Authorization: `Bearer ${result.token}` }
      return result.fields === undefined ? { headers } : { headers, tokenFields: result.fields }
    }
    if (conn.type === 'tokenExchange') {
      const result = yield* resolveTokenExchangeHeader(conn, buildEnvLookup(app.env, process.env))
      if (!result.ok) return { headers: baseHeaders, error: result.reason }
      return { headers: { ...baseHeaders, [result.header]: result.value } }
    }
    // Static auth types (apiKey/basic/bearer): the in-memory props are
    // sufficient to build the header, but we still require a DB row so
    // a runtime DELETE (operator action, accidental cascade, manual SQL)
    // surfaces as a clear action failure rather than silently succeeding.
    const dbMissing = yield* ensureConnectionExistsInDb(connectionName)
    if (dbMissing !== undefined) return { headers: baseHeaders, error: dbMissing }
    // Resolve `$env.` in secret-bearing connection props against the app's
    // declared env vars + the OS environment. Connection definitions are read
    // straight off `app.connections[]` (never through the upstream action-prop
    // env substitution), so a `key: '$env.MY_TOKEN'` ref would otherwise reach
    // the wire verbatim.
    const envLookup = buildEnvLookup(app.env, process.env)
    const built = buildStaticAuthHeader(conn, envLookup)
    if ('error' in built) return { headers: baseHeaders, error: built.error }
    return { headers: { ...baseHeaders, [built.header]: built.value } }
  }).pipe(Effect.withSpan('automations.resolve-connection-headers'))
