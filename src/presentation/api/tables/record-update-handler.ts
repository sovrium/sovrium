/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { updateRecordWithSideEffects } from '@/application/use-cases/tables/record-write-roads'
import { StaleWriteError } from '@/domain/errors'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { handleRouteError } from './error-handlers'
import { isAuthorizationError } from './error-helpers'
import { getLinkReader } from './relationship-rules'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Build the canonical `409 Conflict` response for a stale optimistic-locked
 * write. The envelope uses `message` (the `error` key is
 * being phased out) so callers can surface a reload-and-retry prompt.
 */
function staleWriteConflictResponse(c: Context): Response {
  return c.json(
    {
      success: false,
      message:
        'The record was modified after you last read it. Reload the latest version and retry.',
      code: 'CONFLICT',
    },
    409
  )
}

/**
 * Map a failed update to its response.
 *
 * A stale token is a 409. An RLS refusal is a 404 whether or not the caller can
 * READ the row (S1 anti-enumeration: the write-permission boundary must not be
 * discoverable). Everything else goes through the sanitized error path.
 */
function updateFailureResponse(c: Context, error: unknown): Response {
  if (error instanceof StaleWriteError) return staleWriteConflictResponse(c)
  if (isAuthorizationError(error)) return notFound(c)
  return handleRouteError(c, error)
}

/**
 * One record update — the write and every side effect it carries — as an
 * Effect that resolves to its response. The caller composes it into the
 * handler's program, which runs once on the request's services.
 *
 * Both the JSON verb and the native form verb end here, and whatever the table's
 * automations, the update follows the single path in
 * `record-update-orchestration.ts`.
 */
export function updateResponse(config: {
  readonly session: UserSession
  readonly tableName: string
  readonly recordId: string
  readonly allowedData: Record<string, unknown>
  readonly app: App
  readonly userRole: string
  readonly clientUpdatedAt?: string
  readonly c: Context
}) {
  const { session, tableName, recordId, allowedData, app, userRole, clientUpdatedAt, c } = config
  return Effect.match(
    updateRecordWithSideEffects({
      session,
      app,
      tableName,
      recordId,
      fields: allowedData,
      userRole,
      userGroups: getTableContext(c).userGroups,
      linkReader: getLinkReader(c),
      ...(clientUpdatedAt === undefined ? {} : { expectedUpdatedAt: clientUpdatedAt }),
      isSqlite: isSqliteRuntime(),
      processEnv: process.env,
      forgetDerivedVariants: evictTransformCacheForKey,
    }),
    {
      onFailure: (error) => updateFailureResponse(c, error),
      onSuccess: (updated) => (updated === undefined ? notFound(c) : c.json(updated, 200)),
    }
  )
}
