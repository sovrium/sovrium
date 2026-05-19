/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class ShareLinkDatabaseError extends Data.TaggedError('ShareLinkDatabaseError')<{
  readonly cause: unknown
}> {}

export interface ShareLinkRow {
  readonly id: string
  readonly pageName: string
  readonly token: string
  readonly passwordHash: string | undefined
  readonly expiresAt: Date | undefined
  readonly embedAllowed: boolean
  readonly createdById: string | undefined
  readonly createdAt: Date
  readonly revokedAt: Date | undefined
  readonly viewCount: number
  readonly lastAccessedAt: Date | undefined
}

export class ShareLinkRepository extends Context.Tag('ShareLinkRepository')<
  ShareLinkRepository,
  {
    readonly create: (input: {
      readonly pageName: string
      readonly token: string
      readonly passwordHash?: string
      readonly expiresAt?: Date
      readonly embedAllowed?: boolean
      readonly createdById?: string
    }) => Effect.Effect<ShareLinkRow, ShareLinkDatabaseError>
    readonly findByToken: (
      token: string
    ) => Effect.Effect<ShareLinkRow | undefined, ShareLinkDatabaseError>
    readonly findActiveByToken: (
      token: string
    ) => Effect.Effect<ShareLinkRow | undefined, ShareLinkDatabaseError>
    readonly listForPage: (
      pageName: string
    ) => Effect.Effect<readonly ShareLinkRow[], ShareLinkDatabaseError>
    readonly update: (input: {
      readonly token: string
      readonly passwordHash?: string | null
      readonly expiresAt?: Date | null
      readonly embedAllowed?: boolean
    }) => Effect.Effect<ShareLinkRow | undefined, ShareLinkDatabaseError>
    readonly revoke: (token: string) => Effect.Effect<boolean, ShareLinkDatabaseError>
    readonly recordAccess: (token: string) => Effect.Effect<number, ShareLinkDatabaseError>
  }
>() {}
