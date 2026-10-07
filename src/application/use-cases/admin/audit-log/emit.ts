/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Audit-log emit + query use cases.
 *
 * `EmitAuditEvent` is the single funnel every audit-emitting handler calls
 * after the audited action has run. `ListAuditEvents` is the read side
 * backing `GET /api/admin/audit-log`. Both reach the store through the
 * `AuditLogRepository` port; the async spelling Hono handlers call lives at
 * the presentation edge (`presentation/api/admin/audit-events.ts`), which is
 * where the Live store is provided.
 *
 * Construction of the entry id and timestamp lives here so emitters never
 * synthesize them by hand — handlers describe the action; the use-case
 * supplies the immutable fields.
 */

import { Effect } from 'effect'
import {
  AuditLogRepository,
  type AuditListFilter,
} from '@/application/ports/repositories/admin/audit-log-repository'
import { resolveResourceType } from '@/domain/models/api/admin/audit-log/action-catalog'
import { logWarning } from '@/infrastructure/logging/logger'
import type {
  AuditLogEntry,
  AuditResult,
  AuditTransport,
} from '@/domain/models/api/admin/audit-log/entry'
import type { Actor } from '@/domain/models/api/admin/envelope/actor'
import type { Severity } from '@/domain/models/api/admin/envelope/severity'

/**
 * Input to `emitAuditEvent`.
 *
 * Handlers describe the action and the resource id; the use-case
 * resolves the canonical `resource.type` via the catalog so a typo or an
 * un-registered action surfaces here (we throw rather than emit a junk
 * resource type).
 */
export interface EmitAuditInput {
  readonly action: string
  readonly actor: Actor
  readonly resourceId: string
  readonly resourceName?: string | undefined
  readonly severity: Severity
  readonly result: AuditResult
  /**
   * Transport ("canal") this action was made through. Optional at the call
   * site so existing read-emit handlers (which all run over the REST API) do
   * not have to be touched; it defaults to `api`. Config-mutation handlers MUST
   * pass the real transport (e.g. `config-file` for the file-rebase path) so the
   * Activity feed's channel column is complete across every mutation path.
   */
  readonly transport?: AuditTransport | undefined
  readonly metadata?: Readonly<Record<string, unknown>> | undefined
}

/**
 * Emit one audit-log entry.
 *
 * Persists through the `AuditLogRepository` port, whose write is total: a
 * boot-path failure (table missing) is absorbed and logged by the store, never
 * propagated to the request whose action already succeeded.
 */
export const EmitAuditEvent = (
  input: EmitAuditInput
): Effect.Effect<void, never, AuditLogRepository> =>
  Effect.gen(function* () {
    const resourceType = resolveResourceType(input.action)
    if (!resourceType) {
      // Programming error — the action is not in the catalog. We log and
      // skip rather than failing so a missing catalog entry does not crash
      // the request that already succeeded.
      logWarning(
        `[audit-log] action "${input.action}" not in catalog — emit dropped. Add to action-catalog.ts.`
      )
      return
    }

    const entry: Readonly<AuditLogEntry> = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: input.action,
      actor: input.actor,
      resource: input.resourceName
        ? { type: resourceType, id: input.resourceId, name: input.resourceName }
        : { type: resourceType, id: input.resourceId },
      severity: input.severity,
      result: input.result,
      // First-class transport — every entry carries a closed-enum canal value.
      // Defaults to `api` (every admin emit today happens over the REST API);
      // config-mutation handlers override it with the real transport.
      transport: input.transport ?? 'api',
      ...(input.metadata ? { metadata: input.metadata } : {}),
    }

    yield* (yield* AuditLogRepository).append(entry)
  }).pipe(Effect.withSpan('admin.audit-log.emit', { attributes: { action: input.action } }))

/** List entries matching the optional filter, newest first. */
export const ListAuditEvents = (
  filter?: AuditListFilter
): Effect.Effect<readonly AuditLogEntry[], never, AuditLogRepository> =>
  Effect.gen(function* () {
    return yield* (yield* AuditLogRepository).list(filter)
  }).pipe(Effect.withSpan('admin.audit-log.list'))
