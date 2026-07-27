/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { UserMetadataWithOptionalImage } from '@/application/ports/models/user-metadata'
import type { UserSession } from '@/application/ports/models/user-session'
import type { DatabaseError } from '@/domain/errors'
import type { Effect } from 'effect'

export interface CommentWithUser {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string | null
  readonly parentId: string | null
  readonly content: string
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly user: UserMetadataWithOptionalImage | undefined
  readonly guestName: string | null
  readonly guestEmail: string | null
}

export interface CommentForAuth {
  readonly id: string
  readonly userId: string | null
  readonly recordId: string
  readonly tableId: string
}

export interface CommentUser {
  readonly id: string
  readonly role: string | undefined
}

export interface ListedComment {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string | null
  readonly parentId: string | null
  readonly content: string
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly user?: UserMetadataWithOptionalImage | undefined
  readonly guestName?: string | null
  readonly guestEmail?: string | null
}

export class CommentRepository extends Context.Tag('CommentRepository')<
  CommentRepository,
  {
    readonly create: (config: {
      readonly session: Readonly<UserSession>
      readonly tableId: string
      readonly recordId: string
      readonly content: string
      readonly parentId?: string
      readonly guestName?: string
      readonly guestEmail?: string
      readonly status?: 'approved' | 'pending' | 'rejected'
    }) => Effect.Effect<
      {
        readonly id: string
        readonly tableId: string
        readonly recordId: string
        readonly userId: string | null
        readonly content: string
        readonly parentId: string | null
        readonly status: 'approved' | 'pending' | 'rejected'
        readonly createdAt: Date
        readonly guestName: string | null
        readonly guestEmail: string | null
      },
      DatabaseError
    >

    readonly listAuthorsForRecord: (config: {
      readonly session: Readonly<UserSession>
      readonly recordId: string
    }) => Effect.Effect<readonly string[], DatabaseError>

    readonly listAuthorEmailsForRecord: (config: {
      readonly session: Readonly<UserSession>
      readonly recordId: string
    }) => Effect.Effect<
      readonly { readonly userId: string; readonly email: string }[],
      DatabaseError
    >

    readonly getUserEmailById: (config: {
      readonly session: Readonly<UserSession>
      readonly userId: string
    }) => Effect.Effect<string | undefined, DatabaseError>

    readonly getUserMetadataById: (config: {
      readonly session: Readonly<UserSession>
      readonly userId: string
    }) => Effect.Effect<
      { readonly id: string; readonly email: string; readonly name: string } | undefined,
      DatabaseError
    >

    readonly hasApprovedGuestComment: (config: {
      readonly session: Readonly<UserSession>
      readonly tableId: string
      readonly guestEmail: string
    }) => Effect.Effect<boolean, DatabaseError>

    readonly getWithUser: (config: {
      readonly session: Readonly<UserSession>
      readonly commentId: string
    }) => Effect.Effect<CommentWithUser | undefined, DatabaseError>

    readonly checkRecordExists: (config: {
      readonly session: Readonly<UserSession>
      readonly tableName: string
      readonly recordId: string
      readonly isAdmin?: boolean
    }) => Effect.Effect<boolean, DatabaseError>

    readonly getForAuth: (config: {
      readonly session: Readonly<UserSession>
      readonly commentId: string
    }) => Effect.Effect<CommentForAuth | undefined, DatabaseError>

    readonly getUserById: (config: {
      readonly session: Readonly<UserSession>
      readonly userId: string
    }) => Effect.Effect<CommentUser | undefined, DatabaseError>

    readonly remove: (config: {
      readonly session: Readonly<UserSession>
      readonly commentId: string
    }) => Effect.Effect<void, DatabaseError>

    readonly list: (config: {
      readonly session: Readonly<UserSession>
      readonly recordId: string
      readonly limit?: number
      readonly offset?: number
      readonly sortOrder?: 'asc' | 'desc'
      readonly includeAllStatuses?: boolean
    }) => Effect.Effect<readonly ListedComment[], DatabaseError>

    readonly getCount: (config: {
      readonly session: Readonly<UserSession>
      readonly recordId: string
      readonly includeAllStatuses?: boolean
    }) => Effect.Effect<number, DatabaseError>

    readonly markRead: (config: {
      readonly session: Readonly<UserSession>
      readonly tableId: string
      readonly recordId: string
    }) => Effect.Effect<void, DatabaseError>

    readonly countUnread: (config: {
      readonly session: Readonly<UserSession>
      readonly tableId: string
      readonly recordId: string
    }) => Effect.Effect<number, DatabaseError>

    readonly update: (config: {
      readonly session: Readonly<UserSession>
      readonly commentId: string
      readonly content: string
    }) => Effect.Effect<
      {
        readonly id: string
        readonly tableId: string
        readonly recordId: string
        readonly userId: string | null
        readonly content: string
        readonly createdAt: Date
        readonly updatedAt: Date
      },
      DatabaseError
    >

    readonly updateStatus: (config: {
      readonly session: Readonly<UserSession>
      readonly commentId: string
      readonly status: 'approved' | 'rejected' | 'pending'
    }) => Effect.Effect<
      | {
          readonly id: string
          readonly tableId: string
          readonly recordId: string
          readonly userId: string | null
          readonly content: string
          readonly status: 'approved' | 'rejected' | 'pending'
          readonly createdAt: Date
          readonly updatedAt: Date
        }
      | undefined,
      DatabaseError
    >
  }
>() {}
