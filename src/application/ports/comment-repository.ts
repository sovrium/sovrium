/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { UserSession } from './user-session'
import type { SessionContextError } from '@/domain/errors'
import type { Effect } from 'effect'

/**
 * Comment with user metadata
 */
export interface CommentWithUser {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string
  readonly content: string
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly user:
    | {
        readonly id: string
        readonly name: string
        readonly email: string
        readonly image: string | undefined
      }
    | undefined
}

/**
 * Comment for authorization check (minimal fields)
 */
export interface CommentForAuth {
  readonly id: string
  readonly userId: string
  readonly recordId: string
  readonly tableId: string
}

/**
 * User record for authorization
 */
export interface CommentUser {
  readonly id: string
  readonly role: string | undefined
}

/**
 * Listed comment with required updatedAt
 */
export interface ListedComment {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string
  readonly content: string
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly user?:
    | {
        readonly id: string
        readonly name: string
        readonly email: string
        readonly image: string | undefined
      }
    | undefined
}

/**
 * Comment Repository port for comment CRUD operations
 *
 * Defines the contract for comment creation, retrieval, deletion, and listing.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const comments = yield* CommentRepository
 *   const comment = yield* comments.create({ session, tableId, recordId, content })
 * })
 * ```
 */
export class CommentRepository extends Context.Tag('CommentRepository')<
  CommentRepository,
  {
    readonly create: (config: {
      readonly session: Readonly<UserSession>
      readonly tableId: string
      readonly recordId: string
      readonly content: string
    }) => Effect.Effect<
      {
        readonly id: string
        readonly tableId: string
        readonly recordId: string
        readonly userId: string
        readonly content: string
        readonly createdAt: Date
      },
      SessionContextError
    >

    readonly getWithUser: (config: {
      readonly session: Readonly<UserSession>
      readonly commentId: string
    }) => Effect.Effect<CommentWithUser | undefined, SessionContextError>

    readonly checkRecordExists: (config: {
      readonly session: Readonly<UserSession>
      readonly tableName: string
      readonly recordId: string
    }) => Effect.Effect<boolean, SessionContextError>

    readonly getForAuth: (config: {
      readonly session: Readonly<UserSession>
      readonly commentId: string
    }) => Effect.Effect<CommentForAuth | undefined, SessionContextError>

    readonly getUserById: (config: {
      readonly session: Readonly<UserSession>
      readonly userId: string
    }) => Effect.Effect<CommentUser | undefined, SessionContextError>

    readonly remove: (config: {
      readonly session: Readonly<UserSession>
      readonly commentId: string
    }) => Effect.Effect<void, SessionContextError>

    readonly list: (config: {
      readonly session: Readonly<UserSession>
      readonly recordId: string
      readonly limit?: number
      readonly offset?: number
      readonly sortOrder?: 'asc' | 'desc'
    }) => Effect.Effect<readonly ListedComment[], SessionContextError>

    readonly getCount: (config: {
      readonly session: Readonly<UserSession>
      readonly recordId: string
    }) => Effect.Effect<number, SessionContextError>

    readonly update: (config: {
      readonly session: Readonly<UserSession>
      readonly commentId: string
      readonly content: string
    }) => Effect.Effect<CommentWithUser, SessionContextError>
  }
>() {}
