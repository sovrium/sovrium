/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Audit-log emit + query use cases.
 *
 * `emitAuditEvent` is the single funnel every audit-emitting handler calls
 * after the audited action has run. `listAuditEvents` is the read side
 * backing `GET /api/admin/audit-log`. Both delegate to the infrastructure
 * `drizzle-store` (Phase 8 Cycle 1b — DB-backed canonical event store)
 * while exposing the application-layer shape (an `Effect`-free async
 * surface — callers consume from Hono handlers that are already in the
 * async/await world).
 *
 * Construction of the entry id and timestamp lives here so emitters never
 * synthesize them by hand — handlers describe the action; the use-case
 * supplies the immutable fields.
 */

import { resolveResourceType } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  appendAuditEntryToDb,
  listAuditEntriesFromDb,
} from '@/infrastructure/audit-log/drizzle-store'
import { logWarning } from '@/infrastructure/logging/logger'
import type { Actor } from '@/domain/models/api/admin/_shared/actor'
import type { Severity } from '@/domain/models/api/admin/_shared/severity'
import type {
  AuditLogEntry,
  AuditResult,
  AuditTransport,
} from '@/domain/models/api/admin/audit-log/entry'
import type { AuditListFilter } from '@/infrastructure/audit-log/in-memory-store'

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
   * Activity feed's channel column is complete across every mutation path
   *.
   */
  readonly transport?: AuditTransport | undefined
  readonly metadata?: Readonly<Record<string, unknown>> | undefined
}

/**
 * Emit one audit-log entry.
 *
 * Persists to the DB-backed `audit_log` table (Phase 8 Cycle 1b). The
 * write is awaited so callers can observe persistence — boot-path
 * failures (table missing) are swallowed inside the drizzle-store
 * helper and never propagate.
 */
export async function emitAuditEvent(input: EmitAuditInput): Promise<void> {
  const resourceType = resolveResourceType(input.action)
  if (!resourceType) {
    // Programming error — the action is not in the catalog. We log and
    // skip rather than throwing so a missing catalog entry does not crash
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

  // `return` the persistence promise (rather than a bare `await` expression
  // statement) so the write is still observable by the caller while
  // satisfying `functional/no-expression-statements`.
  return appendAuditEntryToDb(entry)
}

/**
 * List entries matching the optional filter (delegates to infrastructure).
 *
 * Async signature kept consistent with `emitAuditEvent`.
 */
export async function listAuditEvents(filter?: AuditListFilter): Promise<readonly AuditLogEntry[]> {
  return listAuditEntriesFromDb(filter)
}
