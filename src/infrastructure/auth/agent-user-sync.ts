/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'

const AGENT_EMAIL_DOMAIN = 'agents.sovrium.local'

interface AgentForSync {
  readonly name: string
  readonly role: string
}

export const agentEmail = (name: string): string => `${name}@${AGENT_EMAIL_DOMAIN}`

const ensureAgentColumns = async (): Promise<void> => {
  await db
    .execute(sql`ALTER TABLE auth."user" ADD COLUMN IF NOT EXISTS "type" TEXT`)
    .catch(() => undefined)
  await db
    .execute(sql`ALTER TABLE auth."user" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ`)
    .catch(() => undefined)
}

const upsertAgentUser = async (agent: AgentForSync): Promise<void> => {
  const email = agentEmail(agent.name)
  await db
    .execute(
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
    .catch(() => undefined)
}

const softDeleteRemovedAgents = async (keepEmails: readonly string[]): Promise<void> => {
  const placeholders =
    keepEmails.length === 0
      ? sql`(SELECT NULL WHERE false)`
      : sql.join(
          keepEmails.map((email) => sql`${email}`),
          sql`, `
        )
  await db
    .execute(
      sql`
        UPDATE auth."user"
        SET deleted_at = now(), updated_at = now()
        WHERE type = 'agent'
          AND deleted_at IS NULL
          AND email NOT IN (${placeholders})
      `
    )
    .catch(() => undefined)
}

export const syncAgentUsers = async (
  agents: readonly AgentForSync[] | undefined
): Promise<void> => {
  await ensureAgentColumns()

  const list = agents ?? []
  await Promise.all(list.map((agent) => upsertAgentUser(agent)))
  await softDeleteRemovedAgents(list.map((agent) => agentEmail(agent.name)))
}

export const runSyncAgentUsers = async (input: {
  readonly agents: readonly AgentForSync[] | undefined
  readonly hasAuth: boolean
}): Promise<void> => {
  if (!input.hasAuth) return
  if (isSqliteRuntime()) return
  await syncAgentUsers(input.agents).catch((error: unknown) => {
    console.warn('[agents] agent-user sync failed:', error)
  })
}
