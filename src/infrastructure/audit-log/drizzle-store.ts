/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { auditLog } from '@/infrastructure/database/drizzle/schema/audit-log'
import { jsonbLiteral } from '@/infrastructure/database/sql/sql-utils'
import type { ActorRole, ActorType } from '@/domain/models/api/admin/_shared/actor'
import type { Severity } from '@/domain/models/api/admin/_shared/severity'
import type { AuditLogEntry, AuditResult } from '@/domain/models/api/admin/audit-log/entry'
import type { AuditListFilter } from '@/infrastructure/audit-log/in-memory-store'
import type { DrizzleDB, DrizzleTransaction } from '@/infrastructure/database'

type AuditLogRow = typeof auditLog.$inferSelect

type NewAuditLogRow = typeof auditLog.$inferInsert

function rowFromEntry(entry: Readonly<AuditLogEntry>): Readonly<NewAuditLogRow> {
  return {
    id: entry.id,
    createdAt: new Date(entry.timestamp),
    action: entry.action,
    actorId: entry.actor.id,
    actorType: entry.actor.type,
    actorRole: entry.actor.role,
    actorEmail: entry.actor.email ?? null,
    resourceType: entry.resource.type,
    resourceId: entry.resource.id,
    resourceName: entry.resource.name ?? null,
    severity: entry.severity,
    result: entry.result,
    metadata:
      entry.metadata !== undefined ? (jsonbLiteral(entry.metadata) as unknown as null) : null,
  }
}

function rowToEntry(row: Readonly<AuditLogRow>): Readonly<AuditLogEntry> {
  const { actorEmail, resourceName, metadata } = row

  return {
    id: row.id,
    timestamp: new Date(row.createdAt).toISOString(),
    action: row.action,
    actor: {
      id: row.actorId,
      type: row.actorType as ActorType,
      role: row.actorRole as ActorRole,
      ...(actorEmail !== null && actorEmail !== undefined ? { email: actorEmail } : {}),
    },
    resource: {
      type: row.resourceType,
      id: row.resourceId,
      ...(resourceName !== null && resourceName !== undefined ? { name: resourceName } : {}),
    },
    severity: row.severity as Severity,
    result: row.result as AuditResult,
    ...(metadata !== null && metadata !== undefined
      ? { metadata: metadata as Record<string, unknown> }
      : {}),
  }
}

export async function appendAuditEntryToDb(entry: Readonly<AuditLogEntry>): Promise<void> {
  try {
    await db.insert(auditLog).values(rowFromEntry(entry))
  } catch (error) {
    console.warn(
      `[audit-log] failed to persist entry ${entry.id} (${entry.action}): ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

export async function appendAuditEntryToDbTx(
  tx: Readonly<DrizzleTransaction>,
  entry: Readonly<AuditLogEntry>
): Promise<void> {
  const writer = tx as unknown as DrizzleDB
  await writer.insert(auditLog).values(rowFromEntry(entry))
}

export async function listAuditEntriesFromDb(
  filter?: AuditListFilter
): Promise<readonly AuditLogEntry[]> {
  const conditions = [
    filter?.actorId !== undefined ? eq(auditLog.actorId, filter.actorId) : undefined,
    filter?.action !== undefined ? eq(auditLog.action, filter.action) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined)

  try {
    const rows =
      conditions.length === 0
        ? await db.select().from(auditLog).orderBy(desc(auditLog.createdAt))
        : await db
            .select()
            .from(auditLog)
            .where(conditions.length === 1 ? conditions[0] : and(...conditions))
            .orderBy(desc(auditLog.createdAt))

    return rows.map((row) => rowToEntry(row as AuditLogRow))
  } catch (error) {
    console.warn(
      `[audit-log] failed to read entries: ${error instanceof Error ? error.message : String(error)}`
    )
    return []
  }
}

export async function clearAuditLogTable(): Promise<void> {
  try {
    await db.delete(auditLog).where(sql`true`)
  } catch (error) {
    if (isMissingTableError(error)) return
    console.warn(
      `[audit-log] failed to clear table: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

function isMissingTableError(error: unknown): boolean {
  const pgErrno = (error as { cause?: { errno?: unknown } } | undefined)?.cause?.errno
  if (pgErrno === '42P01') return true
  const message = error instanceof Error ? error.message : String(error)
  return /no such table/i.test(message) || /relation .* does not exist/i.test(message)
}
