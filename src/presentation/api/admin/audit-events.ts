/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The audit funnel's async spelling, for Hono handlers.
 *
 * `EmitAuditEvent` is an Effect program that reaches the store through the
 * `AuditLogRepository` port. Handlers that are still written in the async/await
 * style — and a few that run with no request in reach, after the response —
 * call this instead. (The read side, `ListAuditEvents`, is served through the
 * admin read registry and needs no async spelling.) This is the composition seam: the Live store
 * is named HERE, at the presentation edge, never inside the use-case.
 *
 * The program is total (the store absorbs and logs its own failures), so the
 * returned promise only rejects on a defect.
 */

import { Effect } from 'effect'
import { EmitAuditEvent, type EmitAuditInput } from '@/application/use-cases/admin/audit-log/emit'
import { AuditLogRepositoryLive } from '@/infrastructure/database/repositories/admin/audit-log-repository-live'
import type { AuditLogRepository } from '@/application/ports/repositories/admin/audit-log-repository'

const runAudit = <A>(program: Effect.Effect<A, never, AuditLogRepository>): Promise<A> =>
  Effect.runPromise(Effect.provide(program, AuditLogRepositoryLive))

/** Emit one audit-log entry; resolves once it is persisted (or the failure logged). */
export const emitAuditEvent = (input: EmitAuditInput): Promise<void> =>
  runAudit(EmitAuditEvent(input))
