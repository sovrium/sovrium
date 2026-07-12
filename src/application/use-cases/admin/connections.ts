/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Layer } from 'effect'
import {
  type ConnectionDatabaseError,
  ConnectionRepository,
} from '@/application/ports/repositories/connections/connection-repository'
import {
  type ConnectionTokenDatabaseError,
  ConnectionTokenRepository,
  type ConnectionUserSummary,
} from '@/application/ports/repositories/connections/connection-token-repository'
import {
  connectionsListResponseSchema,
  connectionDetailResponseSchema,
  type ConnectionListItem,
  type ConnectionUserToken,
} from '@/domain/models/api/admin/connections/connections'
import {
  deriveConnectionRowAction,
  deriveConnectionStatus,
  soonestExpiryMs,
} from '@/domain/services/admin/connection-status'
import { OAuthStateStoreLive } from '@/infrastructure/connections/oauth-state-store-live'
import { ConnectionRepositoryLive } from '@/infrastructure/database/repositories/connections/connection-repository-live'
import { ConnectionTokenRepositoryLive } from '@/infrastructure/database/repositories/connections/connection-token-repository-live'



function toIso(raw: Readonly<Date> | string): string {
  return raw instanceof Date ? raw.toISOString() : new Date(raw).toISOString()
}

function expiryToIso(raw: Readonly<Date> | string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  return toIso(raw)
}

function buildConnectionItem(
  row: Readonly<Record<string, unknown>>,
  tokens: readonly ConnectionUserSummary[]
): ConnectionListItem {
  const soonestMs = soonestExpiryMs(tokens.map((t) => t.expiresAt))
  const type = String(row['type'])
  const status = deriveConnectionStatus(soonestMs)
  return {
    id: String(row['id']),
    name: String(row['name']),
    provider: String(row['provider']),
    type,
    tokenCount: tokens.length,
    expiresAt: soonestMs === null ? null : new Date(soonestMs).toISOString(),
    status,
    rowAction: deriveConnectionRowAction(type, tokens.length, status),
    createdAt: toIso(row['createdAt'] as Date | string),
  }
}

function buildUserToken(
  summary: Readonly<ConnectionUserSummary>
): ConnectionUserToken {
  return {
    userId: summary.userId,
    expiresAt: expiryToIso(summary.expiresAt),
    status: deriveConnectionStatus(summary.expiresAt),
  }
}


export type ConnectionsListOutcome =
  | { readonly _tag: 'Ok'; readonly body: { readonly connections: readonly ConnectionListItem[] } }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

export const BuildConnectionsList = (): Effect.Effect<
  ConnectionsListOutcome,
  ConnectionDatabaseError | ConnectionTokenDatabaseError,
  ConnectionRepository | ConnectionTokenRepository
> =>
  Effect.gen(function* () {
    const connRepo = yield* ConnectionRepository
    const tokenRepo = yield* ConnectionTokenRepository

    const rows = yield* connRepo.list()

    const connections = yield* Effect.all(
      rows.map((row) =>
        Effect.gen(function* () {
          const tokens = yield* tokenRepo.listUsersForConnection({
            connectionId: String(row['id']),
          })
          return buildConnectionItem(row, tokens)
        })
      )
    )

    const body = { connections }
    const parsed = connectionsListResponseSchema.safeParse(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: { connections: parsed.data.connections } }
  })


export type ConnectionDetailOutcome =
  | {
      readonly _tag: 'Ok'
      readonly body: {
        readonly connection: ConnectionListItem
        readonly tokens: readonly ConnectionUserToken[]
      }
    }
  | { readonly _tag: 'NotFound' }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

export const BuildConnectionDetail = (
  id: string
): Effect.Effect<
  ConnectionDetailOutcome,
  ConnectionDatabaseError | ConnectionTokenDatabaseError,
  ConnectionRepository | ConnectionTokenRepository
> =>
  Effect.gen(function* () {
    const connRepo = yield* ConnectionRepository
    const tokenRepo = yield* ConnectionTokenRepository

    const row = yield* connRepo.findById(id)
    if (row === undefined) {
      return { _tag: 'NotFound' } as const
    }

    const summaries = yield* tokenRepo.listUsersForConnection({ connectionId: String(row['id']) })
    const body = {
      connection: buildConnectionItem(row, summaries),
      tokens: summaries.map((summary) => buildUserToken(summary)),
    }

    const parsed = connectionDetailResponseSchema.safeParse(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: { connection: parsed.data.connection, tokens: parsed.data.tokens } }
  })


export const AdminConnectionsLayer = Layer.mergeAll(
  ConnectionRepositoryLive,
  ConnectionTokenRepositoryLive,
  OAuthStateStoreLive
)
