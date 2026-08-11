/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * RAG knowledge-source access control.
 *
 * An agent may only embed a table its declared `role` is allowed to read.
 * This is the ingest-time backstop behind the decode-time validation in
 * `knowledge-validation.ts`, which rejects the config outright: by the time a
 * config boots, an unreadable knowledge table has already been refused, so this
 * filter exists to keep the embedding store closed even for an entry that
 * reached ingest by some other path.
 *
 * Read-permission semantics (mirrors `hasReadPermission`, the authority on
 * "may role R read table T" for a human caller on the records API):
 *  - `read: 'all'` / `'authenticated'`  → any agent role (agents are authed).
 *  - `read: ['admin', ...]` (role list) → agent role must be in the list, OR
 *    the agent is an `admin` (admin override).
 *  - `read` absent                      → every role except `viewer` (the
 *    lowest-privilege built-in role is default-deny).
 */

import {
  ANY_NON_VIEWER_WHEN_UNDECLARED,
  evaluatePermission,
  permits,
  toPermissionValue,
} from '@/domain/models/shared/permission-evaluation'

/** Minimal shape this service needs from a table. */
interface KnowledgeAccessTable {
  readonly name: string
  readonly permissions?: { readonly read?: unknown }
}

/** Minimal shape this service needs from an agent's knowledge config. */
interface KnowledgeAccessAgent {
  readonly role?: string
  readonly knowledge?: {
    readonly tables?: ReadonlyArray<{
      readonly table: string
      readonly fields: ReadonlyArray<string>
      readonly filter?: Readonly<Record<string, unknown>>
    }>
  }
}

/**
 * Determine whether an agent with `role` may read `read` for knowledge
 * embedding. `read` is the table's `permissions.read` value (or `undefined`).
 *
 * KEEP IN LOCK-STEP with `validateKnowledgeTablePermission` in
 * `src/domain/models/app/agents/knowledge-validation.ts`, which decides the
 * same question at decode time. The two cannot share a helper: the validator is
 * a `domain-model-feature` and this is a `domain-service`, and the boundary
 * rules allow that import in one direction only. Both nonetheless run the ONE
 * canonical evaluator under the same named policy pair, so what could drift is
 * the policy, never the ladder.
 */
export const canAgentReadKnowledgeTable = (role: string, read: unknown): boolean =>
  permits(
    evaluatePermission(
      toPermissionValue(read),
      { role },
      {
        // An absent read grant denies only the lowest-privilege built-in role —
        // the same answer `hasReadPermission` gives a human caller, which is
        // the gate this service claims to mirror. A narrower default made a
        // `supervisor` USER able to read a table its `supervisor` AGENT could
        // not embed.
        whenUndeclared: ANY_NON_VIEWER_WHEN_UNDECLARED,
        // Admins can read everything — the override precedes the fallback, so
        // an agent declared `admin` embeds a table with no `read` grant too.
        adminOverride: 'admin-outranks-everything',
      }
    )
  )

/**
 * Filter an agent's `knowledge.tables[]` down to the tables the agent's role
 * is allowed to read. Unknown tables (not present in `tables`) are kept as-is
 * so downstream validation/sync surfaces them — this service only enforces the
 * read-permission RBAC, not table existence.
 */
export const filterAgentKnowledgeTables = <T extends KnowledgeAccessAgent>(
  agent: T,
  tables: ReadonlyArray<KnowledgeAccessTable>
): T => {
  const knowledgeTables = agent.knowledge?.tables
  if (knowledgeTables === undefined || knowledgeTables.length === 0) return agent

  const role = agent.role ?? 'member'
  const readByTable = new Map(tables.map((t) => [t.name, t.permissions?.read] as const))

  const allowed = knowledgeTables.filter((entry) => {
    // Tables not declared in the schema are passed through untouched.
    if (!readByTable.has(entry.table)) return true
    return canAgentReadKnowledgeTable(role, readByTable.get(entry.table))
  })

  return {
    ...agent,
    knowledge: { ...agent.knowledge, tables: allowed },
  }
}
