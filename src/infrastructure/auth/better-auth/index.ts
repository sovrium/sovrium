/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Better Auth Module
 *
 * Provides authentication functionality using Better Auth library.
 * Re-exports all auth-related services and types.
 */
/**
 * `Auth` comes from `./auth-service`, which does NOT pull the `better-auth`
 * package; `./layer` does. `createAuthLayer` is deliberately NOT re-exported
 * here for that reason — a barrel that re-exported it would drag Better Auth
 * into every importer of this file, including the app layer, which is exactly
 * the eager edge the lazy boundary removes. Its two callers import
 * `./layer` dynamically instead.
 */
export { Auth } from './auth-service'
export { AuthError } from '../../errors/auth-error'
