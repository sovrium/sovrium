/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { createHash, randomBytes } from 'node:crypto'
import { Data, Effect } from 'effect'
import {
  AuthRepository,
  type AuthDatabaseError,
} from '@/application/ports/repositories/auth-repository'
import { BootstrapTokenRepository } from '@/application/ports/repositories/bootstrap-token-repository'
import { Auth } from '@/infrastructure/auth/better-auth'
import type { BootstrapTokenDatabaseError } from '@/application/ports/repositories/bootstrap-token-repository'
import type { BootstrapTokenError } from '@/domain/models/system'


export const BOOTSTRAP_TOKEN_TTL_MS = 60 * 60 * 1000


export class BootstrapAdminCreationError extends Data.TaggedError('BootstrapAdminCreationError')<{
  readonly cause: unknown
}> {}


export const hashBootstrapToken = (plaintext: string): string =>
  createHash('sha256').update(plaintext, 'utf8').digest('hex')

export const generatePlaintextToken = (): string => randomBytes(32).toString('hex')


export interface BootstrapTokenBootContext {
  readonly hasAuthAdminEmailEnv: boolean
  readonly userTableIsEmpty: boolean
}

export type GenerateBootstrapTokenResult =
  | { readonly kind: 'generated'; readonly plaintext: string; readonly expiresAt: Date }
  | { readonly kind: 'skipped'; readonly reason: 'env-var-bootstrap' | 'users-exist' }

export const generateBootstrapTokenIfNeeded = (
  context: BootstrapTokenBootContext,
  now: Date = new Date()
): Effect.Effect<
  GenerateBootstrapTokenResult,
  BootstrapTokenDatabaseError,
  BootstrapTokenRepository
> =>
  Effect.gen(function* () {
    const repo = yield* BootstrapTokenRepository

    if (context.hasAuthAdminEmailEnv) {
      yield* repo.purgeAll()
      return { kind: 'skipped', reason: 'env-var-bootstrap' } as const
    }
    if (!context.userTableIsEmpty) {
      yield* repo.purgeAll()
      return { kind: 'skipped', reason: 'users-exist' } as const
    }

    const plaintext = generatePlaintextToken()
    const tokenHash = hashBootstrapToken(plaintext)
    const expiresAt = new Date(now.getTime() + BOOTSTRAP_TOKEN_TTL_MS)

    yield* repo.create({ tokenHash, expiresAt })

    return { kind: 'generated', plaintext, expiresAt } as const
  })


export interface BootstrapTokenClaimInput {
  readonly token: string
  readonly email: string
  readonly password: string
  readonly name: string
}

export interface BootstrapTokenClaimOutput {
  readonly userId: string
  readonly email: string
}

export const claimBootstrapToken = (
  input: BootstrapTokenClaimInput
): Effect.Effect<
  BootstrapTokenClaimOutput,
  | BootstrapTokenDatabaseError
  | BootstrapTokenError
  | BootstrapAdminCreationError
  | AuthDatabaseError,
  BootstrapTokenRepository | Auth | AuthRepository
> =>
  Effect.gen(function* () {
    const tokenHash = hashBootstrapToken(input.token)

    const repo = yield* BootstrapTokenRepository
    yield* repo.claim(tokenHash)

    const auth = yield* Auth

    const created = yield* Effect.tryPromise({
      try: () =>
        auth.api.createUser({
          body: {
            email: input.email,
            password: input.password,
            name: input.name,
            role: 'admin',
          },
        }),
      catch: (cause) => new BootstrapAdminCreationError({ cause }),
    })

    const userId = (created as { user?: { id?: string } } | undefined)?.user?.id
    if (typeof userId !== 'string' || userId.length === 0) {
      return yield* new BootstrapAdminCreationError({
        cause: new Error('Better Auth createUser returned no user id'),
      })
    }

    const authRepo = yield* AuthRepository
    yield* authRepo.verifyUserEmail(userId)

    return { userId, email: input.email }
  })
