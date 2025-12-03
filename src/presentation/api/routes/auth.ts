/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { zValidator } from '@hono/zod-validator'
import { Effect } from 'effect'
import { z } from 'zod'
import { addMember } from '@/application/use-cases/organization/add-member'
import type { Hono } from 'hono'

/**
 * Auth API Routes
 *
 * Wraps Better Auth SERVER_ONLY endpoints that need HTTP exposure.
 * Better Auth marks certain endpoints (like add-member) as SERVER_ONLY,
 * meaning they can only be called via auth.api.* on the server.
 * This file provides HTTP endpoints that wrap those server-side calls
 * via the Application layer.
 */

/**
 * Add member to organization endpoint
 *
 * Wraps Better Auth's SERVER_ONLY auth.api.addMember() function
 * via the organization service in the Application layer.
 * This endpoint allows authenticated organization owners/admins
 * to add users directly to their organization without invitation flow.
 */
const addMemberSchema = z.object({
  organizationId: z.string(),
  userId: z.string(),
  role: z.enum(['owner', 'admin', 'member']).optional().default('member'),
})

export const chainAuthRoutes = (app: Hono): Hono =>
  app.post('/api/auth/organization/add-member', zValidator('json', addMemberSchema), async (c) => {
    const body = c.req.valid('json')

    const program = addMember({
      organizationId: body.organizationId,
      userId: body.userId,
      role: body.role,
      headers: c.req.raw.headers,
    })

    try {
      const result = await Effect.runPromise(program)
      return c.json(result, 200)
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
        const { status, message } = error as { status: number; message: string }
        return c.json({ message }, status as 200)
      }
      return c.json({ message: 'Internal server error' }, 500)
    }
  })
