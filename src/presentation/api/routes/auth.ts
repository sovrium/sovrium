/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Hono } from 'hono'

/**
 * Auth API Routes
 *
 * Currently no custom auth routes are exposed.
 * Better Auth handles all authentication endpoints internally.
 *
 * Note: Organization member addition is done via Better Auth's invitation flow,
 * not through a custom add-member endpoint. Test fixtures can add members
 * directly via the AuthService infrastructure layer.
 */

/**
 * Chain auth routes to Hono app
 *
 * @param app - Hono app instance
 * @returns Hono app with auth routes (currently none)
 */
export const chainAuthRoutes = (app: Hono): Hono => app
