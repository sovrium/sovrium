/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Agent-as-user synchronization for the RBAC integration model.
 *
 * Every AI agent declared in `app.agents[]` is mirrored into the Better Auth
 * `auth.user` table as a user record with `type = 'agent'` and a synthetic
 * email address (`{name}@agents.sovrium.local`). This lets agents inherit the
 * table/field permissions of their assigned role exactly like a human user.
 *
 * Spec coverage:
 *  - agent created in `auth.user` with `type='agent'`.
 *  - synthetic email `{name}@agents.sovrium.local`.
 *  - a role change in config updates the `auth.user`
 *    record on the next startup.
 *  - removing an agent from config soft-deletes (sets
 *    `deleted_at`) the `auth.user` record — the row is never physically
 *    removed so historical activity attribution is preserved.
 *
 * The agent-specific `type` and `deleted_at` columns of `auth.user` are part
 * of the Drizzle schema and created by the migrations, like every other
 * column of the table. Agent rows carry NO `auth.account`
 * credential row, so they can never authenticate via a login endpoint
 * (an AI agent perms spec — the rejection is a natural consequence of having
 * no password account, not a special-case code path).
 *
 * Every statement is best-effort (`bestEffort(...).promise`): a sync failure
 * must never block server startup, and is logged with its cause rather than lost.
 */

import { sql } from 'drizzle-orm'
import { getPgDb } from '@/infrastructure/database/drizzle/portable-db'
import { bestEffort } from '@/infrastructure/logging/best-effort'
import { logError } from '@/infrastructure/logging/logger'
import type { PgDb } from '@/infrastructure/database/drizzle/db'
import type { DatabaseService } from '@/infrastructure/database/drizzle/layer'

/** Default domain for synthetic agent email addresses. */
const AGENT_EMAIL_DOMAIN = 'agents.sovrium.local'

/** Structural shape of an agent needed for user-record synchronization. */
interface AgentForSync {
  readonly name: string
  readonly role: string
}

/** Build the synthetic email address for an agent user record. */
export const agentEmail = (name: string): string => `${name}@${AGENT_EMAIL_DOMAIN}`

/**
 * Upsert a single agent's `auth.user` row.
 *
 * Keyed on the synthetic email so the operation is idempotent across server
 * restarts. On conflict the `role` is refreshed and
 * any prior soft-delete tombstone is cleared (an agent re-added to config is
 * reactivated, never duplicated).
 */
const upsertAgentUser = async (db: PgDb, agent: AgentForSync): Promise<void> => {
  const email = agentEmail(agent.name)
  // One agent's row failing must not stop the others, nor the boot.
  await bestEffort('[agents] agent user not upserted', { agent: agent.name }).promise(
    db.execute(
      sql`
        INSERT INTO auth."user" (id, name, email, email_verified, role, type, created_at, updated_at)
        VALUES (
          ${crypto.randomUUID()}, ${agent.name}, ${email}, false,
          ${agent.role}, 'agent', now(), now()
        )
        ON CONFLICT (email) DO UPDATE SET
          role = EXCLUDED.role,
          name = EXCLUDED.name,
          type = 'agent',
          deleted_at = NULL,
          updated_at = now()
      `
    )
  )
}

/**
 * Soft-delete every agent user whose synthetic email is no longer present in
 * the current config. Rows are tombstoned via
 * `deleted_at = now()`, never physically removed.
 */
const softDeleteRemovedAgents = async (db: PgDb, keepEmails: readonly string[]): Promise<void> => {
  const placeholders =
    keepEmails.length === 0
      ? sql`(SELECT NULL WHERE false)`
      : sql.join(
          keepEmails.map((email) => sql`${email}`),
          sql`, `
        )
  // A tombstone that fails is retried by the next boot's sync; it must not stop this one.
  await bestEffort('[agents] removed agent users not soft-deleted').promise(
    db.execute(
      sql`
        UPDATE auth."user"
        SET deleted_at = now(), updated_at = now()
        WHERE type = 'agent'
          AND deleted_at IS NULL
          AND email NOT IN (${placeholders})
      `
    )
  )
}

/**
 * Synchronize all `app.agents[]` declarations into the `auth.user` table.
 *
 * Runs once at server startup, after schema migrations. Idempotent: re-running
 * with the same config is a no-op; re-running with a changed config promotes /
 * demotes roles and soft-deletes removed agents.
 */
export const syncAgentUsers = async (
  db: PgDb,
  agents: readonly AgentForSync[] | undefined
): Promise<void> => {
  const list = agents ?? []
  await Promise.all(list.map((agent) => upsertAgentUser(db, agent)))
  await softDeleteRemovedAgents(
    db,
    list.map((agent) => agentEmail(agent.name))
  )
}

/**
 * Convenience runner mirroring `runSeedAllConnectionDefinitions`.
 *
 * Runs the full sync whenever the app has auth configured — even with an
 * empty / absent `agents` list. The empty-list run is NOT a no-op: it
 * soft-deletes any agent users left over from a previous configuration
 * (an AI agent perms spec — an agent removed from config across a restart).
 * Skipped entirely when auth is absent (agent users only exist alongside an
 * `auth.user` table). Failures are swallowed + logged so a sync error never
 * blocks server startup.
 *
 * SQLite skip: the sync DDL/DML is Postgres-flavoured raw SQL — the
 * schema-qualified `auth."user"` table, `TIMESTAMPTZ`, `now()`, and `ON
 * CONFLICT` upsert. SQLite has no schemas (Better Auth's SQLite adapter uses
 * the flat `auth_user` table) and the SQLite client has no `.execute()` at
 * all. Rather than emit a `db.execute is not a function`
 * warning per statement and silently no-op, the runner self-skips on the
 * SQLite runtime — mirroring the boot-path skip in the AI knowledge/compute
 * listeners. Agent-as-user RBAC mirroring is a PostgreSQL-only feature.
 */
export const runSyncAgentUsers = async (input: {
  readonly agents: readonly AgentForSync[] | undefined
  readonly hasAuth: boolean
  /** The boot's `Database` service: the client the sync writes through, and its dialect. */
  readonly database: DatabaseService
}): Promise<void> => {
  if (!input.hasAuth) return
  // SQLite runtime: agent-user sync is a Postgres-only feature — skip cleanly
  // instead of warning on the missing `db.execute`. See the doc comment above.
  if (input.database.dialect.kind === 'sqlite') return
  await syncAgentUsers(getPgDb(input.database), input.agents).catch((error: unknown) => {
    logError('[agents] agent-user sync failed', error)
  })
}
