/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createAuthClient } from 'better-auth/client'

/**
 * Better Auth client for client-side auth operations.
 *
 * Provides typed methods for sign-in, sign-up, sign-out, password reset,
 * and session management. Used by auth form islands and any component
 * that needs auth state.
 *
 * The client is configured to target the same origin — auth routes are
 * served at /api/auth/* by the Hono server.
 */
export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : '',
})
