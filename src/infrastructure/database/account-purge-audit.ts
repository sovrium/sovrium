/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  appendAuditEntryToDbTx,
  shedActorEmailInDbTx,
} from '@/infrastructure/audit-log/drizzle-store'
import type { AuditLogEntry } from '@/domain/models/api/admin/audit-log/entry'
import type { DrizzleTransaction } from '@/infrastructure/database'

/**
 * Build the `account.deletion.purged` audit entry for an erasure.
 *
 * The actor is the SWEEP, not the person swept. `POST /api/account/purge-due` is
 * gated by an internal scheduler token rather than a session, so nobody is
 * logged in when this entry is written — it is exactly the "background job,
 * scheduled archival" case the `system` actor type is defined for. The human
 * attribution for the erasure already exists on the `account.deletion.scheduled`
 * entry written at request time, with the user as actor; repeating it here would
 * name the erased person as the author of the job that erased them.
 *
 * The actor is `type: 'system'` with `role: 'system'`, never `type: 'user'` with
 * `role: 'system'`: that is the one pair the actor contract forbids, since
 * `actorRoleSchema` defines `system` as the NON-HUMAN sentinel and says it is
 * "never valid for a `type: 'user'` actor". The sweep really is non-human, so the
 * TYPE says so.
 *
 * Nothing about the erased user is lost. They are the `resource` the sweep acted
 * upon, and the metadata carries `erasedUserId` + `erasedEmail` so operators can
 * still answer "who was erased?" via `metadata->>'erasedEmail'`. `actor.id` is
 * `null` because system actors have no user identity — which is where a user
 * actor would end up regardless, since the `actor_id` FK's `ON DELETE SET NULL`
 * null-ifies it on commit one statement later. The email is likewise kept OUT of
 * the actor block: the metadata copy is the one the erasure deliberately keeps,
 * and the erasure clears `actor_email` on every other entry the person made.
 *
 * @param userId - The user being erased.
 * @param erasedEmail - Their email, captured before the user row is deleted.
 */
function buildPurgeAuditEntry(
  userId: string,
  erasedEmail: string | undefined
): Readonly<AuditLogEntry> {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    action: AUDIT_ACTIONS.ACCOUNT_DELETION_PURGED,
    actor: {
      id: null,
      type: 'system',
      role: 'system',
    },
    resource: { type: 'user', id: userId },
    severity: 'critical',
    result: 'success',
    // The transport field is first-class on every audit entry. The purge
    // completes a deletion requested through the REST API, so it audits as
    // `api` (the transport enum is config-mutation-oriented; `api` is the
    // sensible canal for an API-initiated account lifecycle event).
    transport: 'api',
    metadata: {
      erasedUserId: userId,
      ...(erasedEmail ? { erasedEmail } : {}),
    },
  }
}

/**
 * The erasure's two writes to the audit trail, inside its transaction and
 * before the user row is deleted.
 *
 * First the address on every entry the user made is cleared. The entries stay
 * — they record what was done to the instance — but `actor_email` is a plain
 * column the `actor_id` FK never touches, so it is cleared by `actor_id` while
 * that id still links the row to the person. Then the `account.deletion.purged`
 * entry is appended; its `metadata.erasedEmail` is the one retained copy of the
 * address, the proof the erasure happened. On commit the FK null-ifies the
 * remaining `actor_id`s when the user row goes.
 */
export async function settleAuditTrail(
  tx: Readonly<DrizzleTransaction>,
  userId: string,
  erasedEmail: string | undefined
): Promise<void> {
  await shedActorEmailInDbTx(tx, userId)
  await appendAuditEntryToDbTx(tx, buildPurgeAuditEntry(userId, erasedEmail))
}

/**
 * The `account.deletion.deferred` entry: the sweep left a due account in place
 * because it is the last one that can administer the app. The account is named
 * by its id alone — no address, no name — so the entry names no one once the
 * account is finally erased.
 */
export function buildDeferredErasureEntry(userId: string): Readonly<AuditLogEntry> {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    action: AUDIT_ACTIONS.ACCOUNT_DELETION_DEFERRED,
    actor: { id: null, type: 'system', role: 'system' },
    resource: { type: 'user', id: userId },
    severity: 'warning',
    result: 'failure',
    transport: 'api',
    metadata: { reason: 'last-admin' },
  }
}
