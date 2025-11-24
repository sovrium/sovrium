/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Hono } from 'hono'
import { auth } from '@/infrastructure/auth/better-auth/auth'

/**
 * Setup custom auth endpoint aliases
 *
 * Creates backward-compatible endpoint aliases for Better Auth endpoints
 * that have been renamed or deprecated. These aliases ensure our API
 * contract remains stable even when underlying auth library changes.
 *
 * Current aliases:
 * - POST /api/auth/forget-password → /api/auth/request-password-reset
 *
 * @param honoApp - Hono application instance
 * @returns Hono app with custom auth aliases configured
 */
export function setupAuthAliases(honoApp: Readonly<Hono>): Readonly<Hono> {
  // Alias: /api/auth/forget-password → /api/auth/request-password-reset
  // Better Auth v1.4.0+ renamed forgetPassword to request-password-reset
  // We maintain the forget-password endpoint for API contract stability
  return honoApp.post('/api/auth/forget-password', async (c) => {
    // Forward request to Better Auth's request-password-reset endpoint
    // by modifying the URL path and delegating to auth.handler
    const originalRequest = c.req.raw
    const url = new URL(originalRequest.url)
    url.pathname = '/api/auth/request-password-reset'

    // Create new request with modified path
    const modifiedRequest = new Request(url.toString(), {
      method: originalRequest.method,
      headers: originalRequest.headers,
      body: originalRequest.body,
      // @ts-expect-error - duplex is needed for request body streaming
      duplex: 'half',
    })

    // Delegate to Better Auth handler
    return auth.handler(modifiedRequest)
  })
}
