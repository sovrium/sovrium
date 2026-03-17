/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
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
 * @example
 * ```typescript
 * import { Auth, AuthLive } from '@/infrastructure/auth'
 *
 * const program = Effect.gen(function* () {
 *   const auth = yield* Auth
 *   const session = yield* auth.requireSession(headers)
 *   return session.user
 * }).pipe(Effect.provide(AuthLive))
 * ```
 */

export { auth } from './better-auth/auth'
export { Auth, AuthLive, AuthError } from './better-auth/layer'
