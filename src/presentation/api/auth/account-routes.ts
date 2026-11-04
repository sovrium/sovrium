/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { purgeExpiredActivityLogs } from '@/application/use-cases/activity/purge-expired-activity-logs'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log-emit'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import {
  cancelAccountDeletion,
  exportAccount,
  GRACE_PERIOD_DAYS,
  loadPendingErasure,
  scheduleAccountDeletion,
} from '@/application/use-cases/auth/account'
import { loadSignatureExport } from '@/application/use-cases/auth/account-export-signatures'
import { loadSocialExport } from '@/application/use-cases/auth/account-export-social'
import { accountRemovalRefusal } from '@/application/use-cases/auth/last-admin-rail'
import { purgeDueAccounts } from '@/application/use-cases/auth/purge-due-accounts'
import { getUserGroups } from '@/application/use-cases/tables/user-groups'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import { activityRetentionResponseSchema } from '@/domain/models/api/auth/account'
import {
  accountDeleteCancelledResponseSchema,
  accountDeleteRequestSchema,
  accountDeleteScheduledResponseSchema,
  accountExportResponseSchema,
  accountPendingErasureResponseSchema,
} from '@/domain/models/api/auth/account/account'
import { isFieldReadableByCaller } from '@/domain/models/app/tables/field-read-filter-service'
import { relatedValuesRefusedTo } from '@/domain/models/app/tables/lookup-link-service'
import { toManyLinksRefusedTo } from '@/domain/models/app/tables/related-field-read-service'
import { translatableFieldNamesOf } from '@/domain/models/app/tables/translatable-query-service'
import { writeOnlyFieldNames } from '@/domain/models/app/tables/write-only-field-service'
import { resolvePurgeTableAuthorship } from '@/infrastructure/database/account-purge-authorship'
import { chainAccountAvatarRoutes } from '@/presentation/api/auth/account-avatar-routes'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import {
  internalSchedulerNotFound,
  isInternalSchedulerRequest,
} from '@/presentation/api/runtime/internal-scheduler-gate'
import { decodeJsonBody } from '@/presentation/api/runtime/request-body'
import {
  answerFailures,
  respondWith,
  runHandlerEffect,
} from '@/presentation/api/runtime/run-effect'
import type { AvatarProfileStore } from '@/application/ports/contracts/avatar-profile-store'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * Account self-service & GDPR API routes.
 *
 *   - `POST /api/account/avatar`          — set the caller's profile image
 *   - `DELETE /api/account/avatar`        — clear it (and remove the object)
 *   - `GET  /api/account/export`          — GDPR Art. 15 + 20 (D4)
 *   - `GET  /api/account/pending-erasure` — the caller's own pending erasure as
 *                                           a `{ items }` rows envelope (binds the
 *                                           GDPR pending-erasure data-table)
 *   - `POST /api/account/delete`          — GDPR Art. 17 (D5)
 *   - `POST /api/account/purge-due`       — runs the D3 hard-delete scheduler
 *   - `POST /api/account/retention-due`   — runs the activity-log retention sweep
 *
 * `export`, `pending-erasure`, and `delete` operate only on the authenticated
 * caller. There is no
 * client-supplied user id, so cross-account access is impossible by
 * construction (anti-enumeration): a request to `/api/account/:id/delete`
 * matches no route and falls through to the 404 handler.
 *
 * The raw data access (auth-table reads, the POSTGRES-ONLY `information_schema`
 * introspection, the dynamic authored-record scans, and the transactional
 * schedule-erasure write) now lives behind `AccountRepository`
 * (`@/application/ports/repositories/account-repository`); this route keeps the
 * HTTP/auth/validation surface, drives the use cases via `provideAccountLive`,
 * and performs the post-write audit emit.
 *
 * `purge-due` is NOT a per-caller endpoint — it runs the destructive erasure
 * sweep across every due account. In production the sweep runs on a recurring
 * cron (`register-account-purge.ts`); this HTTP route exists only as a
 * deterministic trigger for the E2E specs. It is gated behind an internal
 * shared-secret token (`INTERNAL_SCHEDULER_TOKEN`): a caller must present a
 * matching `X-Internal-Scheduler-Token` header, and the route 404s otherwise.
 * Production never sets the env var, so the route is unreachable there — no
 * anonymous internet client can trigger hard deletes. The route runs the
 * `purgeDueAccounts` use-case, which reaches the cron's own sweep through the
 * `RetentionSweeps` port.
 *
 * `retention-due` is the same shape for the same reason: an internal trigger for
 * the activity-log retention sweep, gated by the SAME token and unreachable in
 * production, where the sweep runs on the daily cron armed by
 * `register-activity-log-retention.ts`.
 */

/** Canonical 401 envelope (no personal data leaks). */
const unauthorized = (c: Context) =>
  c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)

// ============================================================================
// D4 — GET /api/account/export
// ============================================================================

/**
 * The fields of `tableName` the caller's read rules withhold from her: a field
 * a rule refuses her, a link to many records she may not read, and a count,
 * rollup or lookup read through one or into a table she may not read. Her
 * export leaves them out, as every other read of her records does.
 */
const withheldFieldNames = (
  app: App,
  tableName: string,
  reader: { readonly role: string; readonly groups: readonly string[] }
): readonly string[] => {
  const related = { ...reader, signedOut: false }
  const refused = new Set([
    ...relatedValuesRefusedTo(app, tableName, related),
    ...toManyLinksRefusedTo(app, tableName, related),
  ])
  return (app.tables?.find((t) => t.name === tableName)?.fields ?? [])
    .map((field) => field.name)
    .filter((name) => refused.has(name) || !isFieldReadableByCaller(app, tableName, reader, name))
}

/**
 * Handle GET /api/account/export.
 *
 * Aggregates the caller's full personal-data footprint. The user id comes
 * only from the session — there is no `:userId` path param, so a
 * cross-account export is impossible by construction. The repository read +
 * payload shaping + contract validation live in the {@link exportAccount} use
 * case; the route resolves the session and serializes the result.
 */
function handleExport(c: Context, app: App): Promise<Response> | Response {
  const session = getSessionContext(c)
  if (session === undefined) return unauthorized(c)
  const { userId } = session
  return runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const [role, groups] = yield* Effect.all([getUserRole(userId, app), getUserGroups(userId)])
        // The read positions, last-seen time and notifications first: the export carries them.
        const social = yield* loadSocialExport(userId)
        // Every signature she gave from her account, with what the evidence keeps of her.
        const { signatures } = yield* loadSignatureExport(userId)
        const outcome = yield* exportAccount(
          userId,
          // Candidate authorship columns resolved from the DECLARED FIELD TYPES,
          // matching the erasure sweep. Probing the literal `created_by` alone made
          // the export blind to a config that names the field anything else.
          (app.tables ?? []).map((t) => {
            const resolved = resolvePurgeTableAuthorship(app.tables, t.name)
            return {
              tableName: resolved.name,
              columns: resolved.createdByColumns,
              writeOnly: writeOnlyFieldNames(app, t.name),
              withheld: withheldFieldNames(app, t.name, { role, groups }),
              ...(app.languages === undefined
                ? {}
                : {
                    translatable: {
                      fields: [...translatableFieldNamesOf(app, t.name)],
                      languages: app.languages,
                    },
                  }),
            }
          }),
          { ...social, signatures }
        )
        if (outcome._tag === 'Unauthorized') return unauthorized(c)
        return yield* respondWith(c, Effect.succeed(outcome.body), accountExportResponseSchema)
      })
    )
  )
}

// ============================================================================
// GET /api/account/pending-erasure
// ============================================================================

/**
 * Handle GET /api/account/pending-erasure.
 *
 * Surfaces the caller's OWN pending erasure as a `{ items }` rows envelope so the
 * GDPR pending-erasure data-table can bind to it (`dataSource.system`) and
 * re-query it on `onSuccess.refetch` after the erase/cancel POSTs. The user id
 * comes only from the session — there is no `:userId` param, so the read is
 * session-scoped with no enumeration surface. Exactly one item while an erasure
 * is scheduled; an empty `items` array once it is cancelled (or never requested).
 */
function handlePendingErasure(c: Context): Promise<Response> | Response {
  const session = getSessionContext(c)
  if (session === undefined) return unauthorized(c)

  return runHandlerEffect(
    c,
    respondWith(c, loadPendingErasure(session.userId), accountPendingErasureResponseSchema)
  )
}

// ============================================================================
// D5 — POST /api/account/delete
// ============================================================================

/**
 * Handle POST /api/account/delete.
 *
 * Body is a union: `{ confirm: true }` schedules an erasure 7 days out
 * and revokes every caller session; `{ cancel: true }` clears a pending
 * erasure. A body matching neither shape is rejected 400.
 *
 * The last admin who can sign in cannot schedule their own erasure: it is
 * refused with 409 and the rail's own message, before anything is written or
 * any session revoked — the same rule the immediate deletion door and every
 * demotion apply.
 */
async function handleDelete(c: Context, app: App): Promise<Response> {
  const session = getSessionContext(c)
  if (session === undefined) return unauthorized(c)
  const { userId } = session

  const { decoded: parsed } = await decodeJsonBody(c, accountDeleteRequestSchema)
  if (!parsed.success) {
    return c.json(
      { success: false, message: 'A confirm or cancel flag is required', code: 'BAD_REQUEST' },
      400
    )
  }

  if ('cancel' in parsed.data) {
    return runHandlerEffect(
      c,
      respondWith(c, cancelAccountDeletion(userId), accountDeleteCancelledResponseSchema)
    )
  }

  return runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const refusal = yield* accountRemovalRefusal(userId, app)
        if (refusal !== undefined) {
          return c.json({ success: false, message: refusal, code: 'CONFLICT' }, 409)
        }

        // { confirm: true } — schedule the erasure (transactional write inside the use case).
        const result = yield* scheduleAccountDeletion(userId)

        // Emit the audit entry — Phase 8 Cycle 1b. The catalog row
        // (`account.deletion.scheduled` → resource.type `user`) is the canonical
        // pairing; metadata carries the grace period + scheduled timestamp so
        // operator triage can answer "when did this account schedule erasure?"
        // without joining additional tables. Best-effort (catalog miss is logged
        // and dropped inside emitAuditEvent — the user-visible 202 must not fail
        // because of an audit side-effect).
        const actor = yield* resolveActor(userId)
        yield* emitAuditEvent({
          action: AUDIT_ACTIONS.ACCOUNT_DELETION_SCHEDULED,
          actor,
          resourceId: userId,
          severity: 'critical',
          result: 'success',
          metadata: {
            gracePeriodDays: GRACE_PERIOD_DAYS,
            scheduledErasureAt: result.scheduledErasureAt.toISOString(),
          },
        })

        return yield* respondWith(
          c,
          Effect.succeed(result.body),
          accountDeleteScheduledResponseSchema,
          202
        )
      })
    )
  )
}

// ============================================================================
// D3 — POST /api/account/purge-due (scheduler trigger)
// ============================================================================

/**
 * Handle POST /api/account/purge-due.
 *
 * Runs the D3 erasure scheduler: hard-deletes every account whose
 * `scheduledErasureAt` is in the past. This is the deterministic trigger the
 * cron path is exercised through; the same `purgeDueAccounts` logic is what the
 * recurring scheduled job (`register-account-purge.ts`) invokes in production.
 *
 * Because the sweep is destructive and operates on EVERY due account (not just
 * the caller), it must never be reachable by an anonymous internet client. The
 * route is gated behind an internal shared secret:
 *
 *   - If `INTERNAL_SCHEDULER_TOKEN` is unset (the production default), the
 *     route 404s — it behaves as if it does not exist.
 *   - If it is set, the caller must present a matching
 *     `X-Internal-Scheduler-Token` header; a missing or wrong token also 404s.
 *
 * A 404 (not 401/403) is deliberate — it does not confirm the route exists,
 * consistent with the anti-enumeration posture of the rest of this file.
 */
async function handlePurgeDue(c: Context, app: App): Promise<Response> {
  // No token configured (production), or a missing/wrong one → 404, as if the
  // route did not exist (`internal-scheduler-gate.ts`).
  if (!isInternalSchedulerRequest(c)) return internalSchedulerNotFound(c)

  // The sweep resolves each table's authorship columns from its DECLARED FIELD
  // TYPES (`RetentionSweepsLive`), never the literal `created_by`.
  return runHandlerEffect(
    c,
    respondWith(
      c,
      purgeDueAccounts(app).pipe(Effect.map((purgedCount) => ({ status: 'ok', purgedCount })))
    )
  )
}

/**
 * `POST /api/account/retention-due` — run the activity-log retention sweep.
 *
 * The sibling of {@link handlePurgeDue}, gated by the same
 * `INTERNAL_SCHEDULER_TOKEN` shared secret and 404-ing identically when the
 * variable is unset (which is the production posture — the production retention
 * path is the daily cron armed by `registerActivityLogRetentionScheduler`).
 *
 * A SEPARATE route rather than an extra sweep folded into `purge-due`: the two
 * answer different questions. `purge-due` erases the accounts of people who
 * asked to be forgotten; this expires rows past a retention window regardless of
 * whose they are. Merging them would make one endpoint whose failure mode is
 * ambiguous and whose name describes half of what it does.
 */
async function handleRetentionDue(c: Context): Promise<Response> {
  // No token configured (production), or a missing/wrong one → 404, as if the
  // route did not exist (`internal-scheduler-gate.ts`).
  if (!isInternalSchedulerRequest(c)) return internalSchedulerNotFound(c)

  return runHandlerEffect(
    c,
    respondWith(
      c,
      purgeExpiredActivityLogs().pipe(
        Effect.map((deletedCount) => ({ status: 'ok', deletedCount }))
      ),
      activityRetentionResponseSchema
    )
  )
}

/**
 * Chain account self-service routes onto a Hono app.
 *
 * `authMiddleware` is wired upstream in `createApiRoutes` for
 * `/api/account/*` so handlers can read the session and return 401
 * themselves. `requireAuth` is intentionally NOT chained — `purge-due`
 * is an internal scheduler trigger and runs without a session; it is
 * instead gated by the `INTERNAL_SCHEDULER_TOKEN` shared secret inside
 * `handlePurgeDue` (404 without a matching header — see that handler).
 *
 * The avatar verbs are chained from `account/avatar.ts` and take the injected
 * {@link AvatarProfileStore}: they are the only writers of `auth.user.image`,
 * and they reach Better Auth's own update path through that port rather than
 * importing the auth instance (see the port's docblock for why both halves of
 * that sentence are load-bearing).
 *
 * @param honoApp - Hono instance to chain routes onto
 * @param app - Validated application configuration
 * @param avatarStore - Reads/writes the caller's own `auth.user.image`
 * @returns Hono app with account routes chained
 */
export function chainAccountRoutes<T extends Hono>(
  honoApp: T,
  app: App,
  avatarStore: AvatarProfileStore
): T {
  return chainAccountAvatarRoutes(honoApp, app, avatarStore)
    .get('/api/account/export', async (c) => handleExport(c, app))
    .get('/api/account/pending-erasure', async (c) => handlePendingErasure(c))
    .post('/api/account/delete', async (c) => handleDelete(c, app))
    .post('/api/account/purge-due', async (c) => handlePurgeDue(c, app))
    .post('/api/account/retention-due', async (c) => handleRetentionDue(c)) as T
}
