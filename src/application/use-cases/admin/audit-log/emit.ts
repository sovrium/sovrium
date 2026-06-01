/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { resolveResourceType } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  appendAuditEntryToDb,
  listAuditEntriesFromDb,
} from '@/infrastructure/audit-log/drizzle-store'
import type { Actor } from '@/domain/models/api/admin/_shared/actor'
import type { Severity } from '@/domain/models/api/admin/_shared/severity'
import type { AuditLogEntry, AuditResult } from '@/domain/models/api/admin/audit-log/entry'
import type { AuditListFilter } from '@/infrastructure/audit-log/in-memory-store'

export interface EmitAuditInput {
  readonly action: string
  readonly actor: Actor
  readonly resourceId: string
  readonly resourceName?: string | undefined
  readonly severity: Severity
  readonly result: AuditResult
  readonly metadata?: Readonly<Record<string, unknown>> | undefined
}

export async function emitAuditEvent(input: EmitAuditInput): Promise<void> {
  const resourceType = resolveResourceType(input.action)
  if (!resourceType) {

    console.warn(
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
    ...(input.metadata ? { metadata: input.metadata } : {}),
  }

  return appendAuditEntryToDb(entry)
}

export async function listAuditEvents(filter?: AuditListFilter): Promise<readonly AuditLogEntry[]> {
  return listAuditEntriesFromDb(filter)
}
