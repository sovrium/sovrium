/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'

/**
 * Admin audit-log actor types.
 *
 * Reflects the four classes of subject that can produce side-effects
 * audited by `/api/admin/audit-log`:
 *
 * - `user`     — a human via session cookie or social login
 * - `system`   — internal background jobs, migrations, scheduled archival,
 *                schema-applied changes (no userId)
 * - `api-token`— a role-bound admin/operator/auditor token issued via
 *                `/api/admin/api-tokens` (plan §12 Q5)
 * - `automation` — a Sovrium automation execution (so audit-log entries can
 *                be traced back to the run that emitted them)
 *
 * @see plan §6.2 actor shape (canonical)
 */
export const actorTypeSchema = z
  .enum(['user', 'system', 'api-token', 'automation'])
  .describe('Class of subject that produced the audited action')

/**
 * Admin RBAC role bound to the actor at the time of the action.
 *
 * Three operator-tier roles per plan §12 Q1 plus a `system` sentinel for
 * actions taken by background jobs (which have no human role). The role is
 * captured at write-time so historical audit-log queries reflect the actor's
 * permissions when they acted, not their current permissions.
 *
 * - `admin`    — full read/write/replay/reveal across all admin endpoints
 * - `operator` — read + safe-by-default replay, no schema/user mutations
 * - `auditor`  — read-only across all admin endpoints, no PII reveal
 * - `system`   — non-human actor (background job, migration)
 */
export const actorRoleSchema = z
  .enum(['admin', 'operator', 'auditor', 'system'])
  .describe('RBAC role bound to the actor at the moment the action was emitted')

/**
 * Canonical actor block embedded in every audit-log entry.
 *
 * `id` is nullable because system actors do not have a user id. `email` is
 * optional for the same reason and because api-tokens and automations have no
 * email — only `user` actors carry one. Operators reading the audit log via
 * `/api/admin/audit-log` use this block to answer "who did this?" without
 * cross-joining auth tables.
 */
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

/** @public */
export type ActorType = z.infer<typeof actorTypeSchema>
/** @public */
export type ActorRole = z.infer<typeof actorRoleSchema>
/** @public */
export type Actor = z.infer<typeof actorSchema>
