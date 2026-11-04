/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `GET /api/connections/:name/status` for a connection using the OAuth2
 * `clientCredentials` grant. Nobody authorizes such a connection: the app
 * requests its token itself, before the first call that needs one and again
 * whenever it lapses. So it always answers `connected`, whoever asks, with the
 * stored shared token's expiry, or none before the first call.
 */

import { Effect } from 'effect'
import { readClientCredentialsStatus } from '@/application/use-cases/connections/connection-tokens'
import { connectionStatusResponseSchema } from '@/domain/models/api/connections'
import { logError } from '@/infrastructure/logging/logger'
import { shapedJson } from '@/presentation/api/runtime/run-effect'
import { connectionError } from './error-envelopes'
import type { ConnectionDef } from '@/application/use-cases/connections/connection-definition'
import type { Context } from 'hono'

/** An oauth2 connection the app authenticates itself, with no consent step. */
export const usesClientCredentials = (conn: ConnectionDef): boolean =>
  conn.type === 'oauth2' && conn.props['grantType'] === 'clientCredentials'

/** Answer the status of a `clientCredentials` connection. */
export const clientCredentialsStatus = (c: Context, conn: ConnectionDef) =>
  Effect.gen(function* () {
    const result = yield* readClientCredentialsStatus({ name: conn.name }).pipe(Effect.result)
    if (result._tag === 'Failure') {
      logError('[connections] status lookup failed', result.failure)
      return connectionError(c, 500, 'status_lookup_failed')
    }
    return shapedJson(
      c,
      {
        name: conn.name,
        type: conn.type,
        status: 'connected' as const,
        connected: true,
        expiresAt: result.success.expiresAt?.toISOString() ?? null,
      },
      connectionStatusResponseSchema
    )
  })
