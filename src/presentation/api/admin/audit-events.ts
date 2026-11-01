/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The audit funnel, as a handler reaches it: a step of the handler's one
 * program, which reads the actor and persists the entry on the request's
 * services, so the entry is written before the answer leaves. (The read side,
 * `listAuditEvents`, is served through the admin read registry.) The store is
 * the one the server's domain runtime resolved at boot
 * (`createAppServicesLayer` names `AuditLogRepositoryLive`), read off THIS
 * request: nothing is built per call.
 *
 * The emit is total (the store absorbs and logs its own failures); only the
 * actor read can fail.
 */

import { Effect } from 'effect'
import {
  emitAuditEvent as emitAuditEventEffect,
  type EmitAuditInput,
} from '@/application/use-cases/admin/audit-log-emit'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'

/** One audit-log entry whose actor is the person `userId` names. */
export const emitAuditEventAs = (userId: string, input: Omit<EmitAuditInput, 'actor'>) =>
  resolveActor(userId).pipe(Effect.flatMap((actor) => emitAuditEventEffect({ ...input, actor })))
