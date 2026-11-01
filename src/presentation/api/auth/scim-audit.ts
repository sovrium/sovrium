/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log-emit'
import { logError } from '@/infrastructure/logging/logger'
import type { AuditAction } from '@/domain/models/api/admin/audit-log/action-catalog'

/** The SCIM writes the audit trail records. */
type ScimAuditAction = Extract<AuditAction, `scim.${string}`>

/**
 * Record one SCIM write, through the one audit funnel (`emitAuditEvent`, run
 * as `admin/audit-events.ts` runs it — a sibling slug this one may not import)
 * on THIS request's services. The identity provider is the actor: no person,
 * so `actor.id` is null and the entry says where it came from in its metadata.
 * A failure to record is logged and never fails the write that already stood.
 */
export const recordScimWrite = (action: ScimAuditAction, resourceId: string) =>
  emitAuditEvent({
    action,
    actor: { id: null, type: 'system', role: 'system' },
    resourceId,
    severity: action === 'scim.user.deactivated' ? 'warning' : 'info',
    result: 'success',
    metadata: { source: 'scim' },
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError(`[scim] could not record ${action}`, cause))
    ),
    // effect-swallow: logged above; the audit entry never fails the write that already stood.
    Effect.ignoreCause
  )
