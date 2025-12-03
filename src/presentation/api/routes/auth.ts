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
import { addOrganizationMemberResponseSchema } from '@/presentation/api/schemas/auth-schemas'
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
 * Transform Date objects to ISO strings for Zod validation
 */
const transformDateToISO = (member: unknown): unknown => {
  if (!member || typeof member !== 'object') return member
  if (!('createdAt' in member)) return member

  const { createdAt } = member as { createdAt: unknown }
  return {
    ...(member as Record<string, unknown>),
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
  }
}

/**
 * Add member to organization endpoint
 *
 * Wraps Better Auth's SERVER_ONLY auth.api.addMember() function
 * via the organization service in the Application layer.
 * This endpoint allows authenticated organization owners/admins
 * to add users directly to their organization without invitation flow.
 */
const addMemberRequestSchema = z.object({
  organizationId: z.string().describe('Organization ID to add member to'),
  userId: z.string().describe('User ID to add as member'),
  role: z
    .enum(['owner', 'admin', 'member'])
    .optional()
    .default('member')
    .describe('Role to assign to member'),
})

export const chainAuthRoutes = (app: Hono): Hono =>
  app.post(
    '/api/auth/organization/add-member',
    zValidator('json', addMemberRequestSchema),
    async (c) => {
      const body = c.req.valid('json')

      const program = addMember({
        organizationId: body.organizationId,
        userId: body.userId,
        role: body.role,
        headers: c.req.raw.headers,
      })

      try {
        const result = await Effect.runPromise(program)
        // Transform Date objects to ISO strings for Zod validation
        const transformedResult = {
          member: transformDateToISO(result.member),
        }
        // Validate response against schema for type safety
        const validated = addOrganizationMemberResponseSchema.parse(transformedResult)
        return c.json(validated, 200)
      } catch (error) {
        // Handle ServiceError from use case
        if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
          const { status, message } = error as { status: number; message: string }
          return c.json({ message }, status as 200)
        }
        // Handle other errors
        return c.json(
          {
            message: error instanceof Error ? error.message : 'Internal server error',
          },
          500
        )
      }
    }
  )
