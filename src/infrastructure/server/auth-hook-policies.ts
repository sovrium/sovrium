/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The composition root of the Better Auth hooks' decisions.
 *
 * The hooks (`infrastructure/auth/better-auth/`) observe and refuse what Better
 * Auth writes, but WHAT to refuse and WHAT to record are application use-cases.
 * The server is the infrastructure area allowed to name use-cases, so it binds
 * them here into the {@link AuthHookPolicies} record every auth instance is
 * built with, and the hooks hold no use-case import of their own.
 *
 * Each policy runs on the server's resolved domain services when the instance
 * has them (the instance serving HTTP); an instance built without them (the
 * `Auth` service layer, the seed and provisioning adapters) binds the two
 * repositories the reads and records need, over the `Database` that instance
 * was built with. The automation dispatch needs the whole automation runtime
 * and so runs only on the domain services; without them it starts nothing, as
 * before.
 */

import { Effect, Layer } from 'effect'
import { countActiveAdmins } from '@/application/use-cases/auth/count-admins'
import { readUserRoleById } from '@/application/use-cases/auth/get-user-role'
import { accountRemovalRefusal } from '@/application/use-cases/auth/last-admin-rail'
import { readUserBannedById } from '@/application/use-cases/auth/read-user-ban-state'
import {
  recordAccountDeletionRequest,
  recordBan,
  recordImpersonation,
  recordPasswordSet,
  recordRoleChange,
  recordUnban,
} from '@/application/use-cases/auth/record-user-acts'
import { triggerAuthEventAutomations } from '@/application/use-cases/automations/trigger-auth-event'
import { updateUserRole } from '@/application/use-cases/tables/user-role'
import { Database, type DatabaseService } from '@/infrastructure/database/drizzle/layer'
import { AuditLogRepositoryLive } from '@/infrastructure/database/repositories/admin/audit-log-repository-live'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth/auth-repository-live'
import { logError } from '@/infrastructure/logging/logger'
import { runOnDomain, type DomainContext } from './domain-runtime'
import type { AuthHookPolicies } from '@/application/ports/contracts/auth-hook-policies'
import type { AuditLogRepository } from '@/application/ports/repositories/admin/audit-log-repository'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'

/** The repositories a hook's reads, records and role write need. */
type HookServices = AuthRepository | AuditLogRepository

/** The two repositories over the database the instance was built with. */
const hookServicesOver = (database: DatabaseService) =>
  Layer.mergeAll(AuthRepositoryLive, AuditLogRepositoryLive).pipe(
    Layer.provide(Layer.succeed(Database, database))
  )

/** Run a hook program on the domain services, or on the two repositories it needs. */
const hookRunner = (database: DatabaseService, domainContext: DomainContext | undefined) => {
  const hookServices = hookServicesOver(database)
  return <A, E>(program: Effect.Effect<A, E, HookServices>): Promise<A> =>
    domainContext === undefined
      ? Effect.runPromise(Effect.provide(program, hookServices))
      : runOnDomain(domainContext, program)
}

/**
 * The policies for one auth instance.
 *
 * @param database - The `Database` the instance is built with: a hook with no
 *   domain services reads through the same one the instance's adapter writes to.
 * @param domainContext - The server's resolved services, when the instance is
 *   the one serving HTTP; absent for the instances built outside a request.
 */
export const makeAuthHookPolicies = (
  database: DatabaseService,
  domainContext?: DomainContext
): AuthHookPolicies => {
  const run = hookRunner(database, domainContext)
  return {
    countActiveAdmins: (adminRoles) => run(countActiveAdmins(adminRoles)),
    readUserRole: (userId) => run(readUserRoleById(userId)),
    writeUserRole: (userId, role) => run(updateUserRole(userId, role)),
    recordRoleChange: (input) =>
      run(
        recordRoleChange({
          author: { kind: 'user', userId: input.actorId },
          userId: input.userId,
          previousRole: input.previousRole,
          role: input.role,
        })
      ),
    recordImpersonation: (input) => run(recordImpersonation(input)),
    isUserBanned: (userId) => run(readUserBannedById(userId)),
    recordBan: (input) =>
      run(
        recordBan({
          author: { kind: 'user', userId: input.adminId },
          userId: input.userId,
          expiresAt: input.expiresAt,
        })
      ),
    recordUnban: (input) =>
      run(recordUnban({ author: { kind: 'user', userId: input.adminId }, userId: input.userId })),
    recordPasswordSet: (input) => run(recordPasswordSet(input)),
    refuseAccountRemoval: (userId, app) => run(accountRemovalRefusal(userId, app)),
    recordAccountDeletionRequest: (userId) => run(recordAccountDeletionRequest(userId)),
    dispatchAuthEvent: (input) =>
      domainContext === undefined
        ? Promise.resolve()
        : runOnDomain(domainContext, triggerAuthEventAutomations(input)).catch((err: unknown) => {
            // Swallowed on purpose: an automation must never fail the sign-in,
            // sign-out or reset it reacts to. The cause is logged for the operator.
            logError('[automation:auth-event] auth-event dispatch failed', err)
          }),
  }
}
