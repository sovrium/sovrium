/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { AuditLogEntry } from '@/domain/models/api/admin/audit-log/entry'

const MAX_ENTRIES = 10_000

let entries: readonly AuditLogEntry[] = []

export interface AuditListFilter {
  readonly actorId?: string | undefined
  readonly action?: string | undefined
}

export function appendAuditEntry(entry: Readonly<AuditLogEntry>): void {
  entries = [entry, ...entries].slice(0, MAX_ENTRIES)
}

export function listAuditEntries(filter?: AuditListFilter): readonly AuditLogEntry[] {
  if (!filter || (!filter.actorId && !filter.action)) {
    return [...entries]
  }

  return entries.filter((entry) => {
    if (filter.actorId !== undefined && entry.actor.id !== filter.actorId) return false
    if (filter.action !== undefined && entry.action !== filter.action) return false
    return true
  })
}

export function resetAuditEntries(): void {
  entries = []
}
