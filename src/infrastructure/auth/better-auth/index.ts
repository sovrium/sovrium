/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
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
export { auth } from './auth'
export { Auth, AuthLive, createAuthLayer } from './layer'
export { AuthError } from '../../errors/auth-error'
