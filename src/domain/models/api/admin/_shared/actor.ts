/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'

export const actorTypeSchema = z
  .enum(['user', 'system', 'api-token', 'automation'])
  .describe('Class of subject that produced the audited action')

export const actorRoleSchema = z
  .enum(['admin', 'operator', 'auditor', 'system'])
  .describe('RBAC role bound to the actor at the moment the action was emitted')

export const actorSchema = z
  .object({
    id: z
      .string()
      .nullable()
      .describe(
        'Stable identifier of the actor (user id, api-token id, automation id). Null for `system` actors.'
      ),
    type: actorTypeSchema,
    role: actorRoleSchema,
    email: z
      .email()
      .optional()
      .describe(
        'Email address (only present for `user` actors; absent for system / api-token / automation actors).'
      ),
  })
  .openapi('AuditActor')

export type ActorType = z.infer<typeof actorTypeSchema>
export type ActorRole = z.infer<typeof actorRoleSchema>
export type Actor = z.infer<typeof actorSchema>
