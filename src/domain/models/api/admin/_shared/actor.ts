/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { isAdminRole } from '@/domain/models/shared/permission-evaluation'

/**
 * Admin audit-log actor types.
 *
 * Reflects the four classes of subject that can produce side-effects
 * audited by `/api/admin/audit-log`:
 *
 * - `user`     — a human via session cookie or social login
 * - `system`   — internal background jobs, migrations, scheduled archival,
 *                schema-applied changes (no userId)
 * - `api-token`— a role-bound admin/operator token issued via
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
 * Coarse trust tier bound to the actor at the time of the action.
 *
 * - `admin`    — the built-in `admin` role
 * - `operator` — any other HUMAN actor (the catch-all human tier)
 * - `system`   — the NON-HUMAN sentinel (background job, migration, scheduled
 *                archival). Never valid for a `type: 'user'` actor.
 *
 * ⚠️ THIS FIELD IS COARSE. It is a trust tier, not the actor's role. Sovrium
 * roles are OPEN and app-defined (`auth.roles[]` accepts any lowercase slug),
 * and `isAdminTier` admits FIVE classes of role onto the admin surface
 * (`admin`; `admin-editor`/`admin-viewer`; the legacy `operator`; any role with
 * an explicit `dashboardTier`; and the highest-`level` custom role implicitly).
 * A three-value enum cannot mirror an open set, so it never tries to: it
 * records only the tier. Read `actor.id` / `actor.email` to answer "who did
 * this?" — those are EXACT (`actor_id` is an FK to the users table, so a
 * fabricated actor fails the insert rather than writing a false attribution).
 *
 * Coarse is fine. Contradictory is not: every human actor MUST be coerced
 * through {@link coerceHumanActorRole}, which is the single mapping shared by
 * every emit site so that one person, one session, hitting two endpoints is
 * recorded identically.
 *
 * HISTORY: this began as the four-value operator-plane tier enum
 * `admin | operator | auditor | system` from an external design plan (cited as
 * "§12 Q1"; the plan file no longer exists). `auditor` and the RBAC middleware
 * that enforced the tiers were removed in `a76f3608c`, and `isAdminTier` later
 * grew the config-declared and implicit-top-role admit paths. Widening the enum
 * to carry the full role is a separate API-contract decision: the read route
 * `safeParse`s the WHOLE audit-log response, so a value outside this enum 500s
 * the entire page rather than one row. Widen the enum FIRST, then store wider
 * values — never the reverse.
 */
export const actorRoleSchema = z
  .enum(['admin', 'operator', 'system'])
  .describe(
    'Coarse trust tier of the actor: `admin`, `operator` (any other human), or `system` (non-human). A tier, not the actor’s role — read `id`/`email` for attribution.'
  )

/**
 * Canonical actor block embedded in every audit-log entry.
 *
 * `id` is nullable because system actors do not have a user id. `email` is
 * optional for the same reason and because api-tokens and automations have no
 * email — only `user` actors carry one. Operators reading the audit log via
 * `/api/admin/audit-log` use this block to answer "who did this?" without
 * cross-joining auth tables.
 *
 * That question is answered by `id` and `email`, which are EXACT: `actor_id` is
 * an FK to the users table, so a fabricated actor fails the insert rather than
 * writing a false attribution. `role` is a coarse trust tier — deterministic
 * for a given actor, but not the actor's role — see {@link actorRoleSchema}.
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

/**
 * Map an app-defined role name onto the trust tier recorded for a HUMAN actor.
 *
 * This is the single mapping every `type: 'user'` emit site must use. Sovrium
 * roles are an open set and {@link actorRoleSchema} is a closed three-value
 * enum, so a coercion is unavoidable — the point of centralising it is that the
 * coercion be the SAME one everywhere. Two emit paths that disagree make the
 * recorded tier non-deterministic with respect to the actor, which is worse
 * than coarse: it is unreadable.
 *
 * The mapping:
 *
 * - the built-in `admin` role → `admin`
 * - every other role → `operator`
 *
 * `system` is deliberately unreachable here. It is the NON-HUMAN sentinel, so
 * emitting it for a session-backed caller would write the self-contradictory
 * pair `type: 'user'` + `role: 'system'` — asserting that a person is a
 * background job. `operator` is merely coarse for a `member` or a custom top
 * role; `system` would be false. Lossy-but-true beats precise-but-false.
 *
 * Non-human actors (`system` / `api-token` / `automation`) do NOT come through
 * here; they build their own Actor block and pick their own tier.
 *
 * @param roleName - Role held by the user at the time of the action.
 * @public
 */
export const coerceHumanActorRole = (roleName: string): ActorRole =>
  isAdminRole(roleName) ? 'admin' : 'operator'
