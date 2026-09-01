/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  CancelAccountDeletion,
  ExportAccount,
  GRACE_PERIOD_DAYS,
  LoadPendingErasure,
  ScheduleAccountDeletion,
} from '@/application/use-cases/account'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { accountDeleteRequestSchema } from '@/domain/models/api/account/account'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  purgeDueAccounts,
  resolvePurgeTableAuthorship,
} from '@/infrastructure/database/account-purge'
import { purgeExpiredActivityLogs } from '@/infrastructure/database/activity-log-retention'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { chainAccountAvatarRoutes } from '@/presentation/api/routes/account/avatar'
import { provideAccountLive } from '@/presentation/api/routes/account/effect-runner'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { AvatarProfileStore } from '@/application/ports/models/avatar-profile-store'
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
 * anonymous internet client can trigger hard deletes. `purgeDueAccounts` is
 * itself already an infrastructure helper (its own `db.transaction` hard-delete
 * path), so it is invoked directly rather than through the repository port.
 *
 * `retention-due` is the same shape for the same reason: an internal trigger for
 * the activity-log retention sweep, gated by the SAME token and unreachable in
 * production, where the sweep runs on the daily cron armed by
 * `register-activity-log-retention.ts`.
 */

/**
 * Env var holding the internal shared secret for the `purge-due` trigger.
 * Set ONLY by the E2E harness. Unset in production — which makes the
 * `purge-due` route reject every request (the production erasure path is the
 * recurring cron in `register-account-purge.ts`, not this HTTP route).
 */
const SCHEDULER_TOKEN_ENV = 'INTERNAL_SCHEDULER_TOKEN'

/** Header carrying the internal scheduler token on a `purge-due` request. */
const SCHEDULER_TOKEN_HEADER = 'X-Internal-Scheduler-Token'

/** Canonical 401 envelope (no personal data leaks). */
const unauthorized = (c: Context) =>
  c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)

// ============================================================================
// D4 — GET /api/account/export
// ============================================================================

/**
 * Handle GET /api/account/export.
 *
 * Aggregates the caller's full personal-data footprint. The user id comes
 * only from the session — there is no `:userId` path param, so a
 * cross-account export is impossible by construction. The repository read +
 * payload shaping + contract validation live in the {@link ExportAccount} use
 * case; the route resolves the session and serializes the result.
 */
async function handleExport(c: Context, app: App): Promise<Response> {
  const session = getSessionContext(c)
  if (session === undefined) return unauthorized(c)
  const { userId } = session

  const outcome = await runRequestEffect(
    c,
    ExportAccount(
      userId,
      // Candidate authorship columns resolved from the DECLARED FIELD TYPES,
      // matching the erasure sweep. Probing the literal `created_by` alone made
      // the export blind to a config that names the field anything else.
      (app.tables ?? []).map((t) => {
        const resolved = resolvePurgeTableAuthorship(app.tables, t.name)
        return { tableName: resolved.name, columns: resolved.createdByColumns }
      })
    ).pipe(provideAccountLive)
  )
  if (outcome._tag === 'Unauthorized') return unauthorized(c)
  return c.json(outcome.body, 200)
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
async function handlePendingErasure(c: Context): Promise<Response> {
  const session = getSessionContext(c)
  if (session === undefined) return unauthorized(c)

  const body = await runRequestEffect(
    c,
    LoadPendingErasure(session.userId).pipe(provideAccountLive)
  )
  return c.json(body, 200)
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
 */
async function handleDelete(c: Context): Promise<Response> {
  const session = getSessionContext(c)
  if (session === undefined) return unauthorized(c)
  const { userId } = session

  const rawBody = await c.req.json().catch(() => undefined)
  const parsed = accountDeleteRequestSchema.safeParse(rawBody)
  if (!parsed.success) {
    return c.json(
      { success: false, message: 'A confirm or cancel flag is required', code: 'BAD_REQUEST' },
      400
    )
  }

  if ('cancel' in parsed.data) {
    const body = await runRequestEffect(c, CancelAccountDeletion(userId).pipe(provideAccountLive))
    return c.json(body, 200)
  }

  // { confirm: true } — schedule the erasure (transactional write inside the use case).
  const result = await runRequestEffect(c, ScheduleAccountDeletion(userId).pipe(provideAccountLive))

  // Emit the audit entry — Phase 8 Cycle 1b. The catalog row
  // (`account.deletion.scheduled` → resource.type `user`) is the canonical
  // pairing; metadata carries the grace period + scheduled timestamp so
  // operator triage can answer "when did this account schedule erasure?"
  // without joining additional tables. Best-effort (catalog miss is logged
  // and dropped inside emitAuditEvent — the user-visible 202 must not fail
  // because of an audit side-effect).
  const actor = await resolveActor(userId)
  // eslint-disable-next-line functional/no-expression-statements -- best-effort audit side effect (matches the DB side-effect pattern above)
  await emitAuditEvent({
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

  return c.json(result.body, 202)
}

// ============================================================================
// D3 — POST /api/account/purge-due (scheduler trigger)
// ============================================================================

/**
 * Constant-time string comparison — avoids leaking the token length or a
 * matching prefix through response-timing differences.
 */
function tokensMatch(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false
  // eslint-disable-next-line functional/no-let -- accumulator for constant-time XOR scan
  let mismatch = 0
  // eslint-disable-next-line functional/no-loop-statements -- fixed-length constant-time scan
  for (let i = 0; i < expected.length; i += 1) {
    // eslint-disable-next-line functional/no-expression-statements -- bitwise accumulate
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return mismatch === 0
}

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
  const expectedToken = process.env[SCHEDULER_TOKEN_ENV]
  // No token configured (production) → the route is effectively disabled.
  if (expectedToken === undefined || expectedToken.length === 0) {
    return c.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)
  }

  const providedToken = c.req.header(SCHEDULER_TOKEN_HEADER)
  if (providedToken === undefined || !tokensMatch(providedToken, expectedToken)) {
    return c.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)
  }

  // Authorship columns are resolved from the table's DECLARED FIELD TYPES, not
  // assumed to be the literal `created_by`. A `{ name: 'author',
  // type: 'created-by' }` field is valid config and generates an `author`
  // column; matching by literal name deleted nothing for such a config while
  // still reporting `purgedCount: 1`.
  const purgedCount = await purgeDueAccounts(
    (app.tables ?? []).map((t) => resolvePurgeTableAuthorship(app.tables, t.name))
  )
  return c.json({ status: 'ok', purgedCount }, 200)
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
  const expectedToken = process.env[SCHEDULER_TOKEN_ENV]
  // No token configured (production) → the route is effectively disabled.
  if (expectedToken === undefined || expectedToken.length === 0) {
    return c.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)
  }

  const providedToken = c.req.header(SCHEDULER_TOKEN_HEADER)
  if (providedToken === undefined || !tokensMatch(providedToken, expectedToken)) {
    return c.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)
  }

  const deletedCount = await purgeExpiredActivityLogs()
  return c.json({ status: 'ok', deletedCount }, 200)
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
    .post('/api/account/delete', async (c) => handleDelete(c))
    .post('/api/account/purge-due', async (c) => handlePurgeDue(c, app))
    .post('/api/account/retention-due', async (c) => handleRetentionDue(c)) as T
}
