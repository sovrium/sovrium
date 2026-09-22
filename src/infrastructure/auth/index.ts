/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Authentication Infrastructure Module
 *
 * Provides authentication services and utilities.
 * Currently uses Better Auth for authentication.
 *
 * `createAuthLayer` is NOT re-exported here: it lives in
 * `./better-auth/layer`, which pulls the whole `better-auth` package. Import
 * it dynamically at the point of use, behind an `app.auth` check, so a no-auth
 * boot never loads it (see `NoAuthLayer` in `./better-auth/auth-service`).
 *
 * @example
 * ```typescript
 * import { Auth } from '@/infrastructure/auth'
 *
 * const program = Effect.gen(function* () {
 *   const auth = yield* Auth
 *   const session = yield* auth.requireSession(headers)
 *   return session.user
 * }).pipe(Effect.provide(createAuthLayer(authConfig)))
 * ```
 */

export { Auth, AuthError } from './better-auth/auth-service'
