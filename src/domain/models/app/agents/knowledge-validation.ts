/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Cross-validation for agent table-knowledge configuration
 *.
 *
 * `AgentKnowledgeSchema` validates one knowledge entry in isolation; these
 * rules need the whole `app` because they cross-reference `app.tables`:
 * - [internal ref]: every `knowledge.tables.table` must reference a
 *    declared table, and every `fields[]` entry must be a real column.
 * - [internal ref]: only text-like field types (single-line-text,
 *    long-text, rich-text, markdown) may be embedded as knowledge.
 * - [internal ref]: an agent may only embed a table its auth role
 *    can read, whatever that role is. The rule holds for every role rather than
 *    only for `viewer`, because a denial the author cannot observe is the worse
 *    failure: the alternative is an agent that answers "I don't know" about its
 *    own source material with nothing anywhere to say why.
 */

import {
  ANY_NON_VIEWER_WHEN_UNDECLARED,
  evaluatePermission,
  permits,
  toPermissionValue,
} from '@/domain/models/shared/permission-evaluation'

/** Field types whose content is meaningful to embed for RAG retrieval. */
const TEXT_LIKE_FIELD_TYPES: ReadonlySet<string> = new Set([
  'single-line-text',
  'long-text',
  'rich-text',
  'markdown',
])

/** Minimal structural shape this validator needs from `app`. */
interface AppKnowledgeShape {
  readonly tables?: ReadonlyArray<{
    readonly name: string
    readonly fields: ReadonlyArray<{ readonly name: string; readonly type: string }>
    readonly permissions?: { readonly read?: unknown }
  }>
  readonly agents?: ReadonlyArray<{
    readonly name: string
    readonly role?: string
    readonly knowledge?: {
      readonly tables?: ReadonlyArray<{
        readonly table: string
        readonly fields: ReadonlyArray<string>
      }>
    }
  }>
}

/** A table's resolved knowledge metadata: its field types plus read permission. */
interface KnowledgeTableMeta {
  readonly fieldTypes: ReadonlyMap<string, string>
  readonly read: unknown
}

/**
 * Validate every agent's `knowledge.tables[]` entries against `app.tables`.
 *
 * Returns `true` when all references are valid, or a human-readable error
 * string describing the first violation (so `Schema.filter` surfaces a
 * useful message). The order matters for the spec regexes:
 *  - unknown table / field → `not found` / `does not exist`
 *  - non-text field type   → `field type` / `text` / `knowledge`
 */
type TableFieldMap = ReadonlyMap<string, KnowledgeTableMeta>

/**
 * Validate one knowledge field reference against the table map. Returns an
 * error string on violation, or `undefined` when the reference is valid.
 */
const validateKnowledgeField = (
  agentName: string,
  table: string,
  field: string,
  fieldTypes: ReadonlyMap<string, string>
): string | undefined => {
  const fieldType = fieldTypes.get(field)
  // [internal ref]: unknown field.
  if (fieldType === undefined) {
    return `Agent '${agentName}' knowledge references field '${field}' which does not exist on table '${table}'.`
  }
  // [internal ref]: non-text field type.
  if (!TEXT_LIKE_FIELD_TYPES.has(fieldType)) {
    return `Agent '${agentName}' knowledge field '${table}.${field}' has field type '${fieldType}' which is not a valid text-like knowledge source. Only single-line-text, long-text, rich-text, and markdown fields can be embedded.`
  }
  return undefined
}

/**
 * Validate one agent's `knowledge.tables[]` entries. Returns the first
 * violation message, or `undefined` when every reference is valid.
 */
const validateAgentKnowledge = (
  agent: NonNullable<AppKnowledgeShape['agents']>[number],
  tableMap: TableFieldMap
): string | undefined =>
  (agent.knowledge?.tables ?? [])
    .flatMap((entry): ReadonlyArray<string> => {
      const meta = tableMap.get(entry.table)
      // [internal ref]: unknown table.
      if (meta === undefined) {
        return [
          `Agent '${agent.name}' knowledge references table '${entry.table}' which does not exist (table not found).`,
        ]
      }
      // [internal ref]: the agent's auth role must be able to read
      // the table it embeds — every role, not only `viewer`. An absent
      // `permissions.read` denies only `viewer`.
      const rbacError = validateKnowledgeTablePermission(agent, entry.table, meta.read)
      if (rbacError !== undefined) {
        return [rbacError]
      }
      return entry.fields
        .map((field) => validateKnowledgeField(agent.name, entry.table, field, meta.fieldTypes))
        .filter((msg): msg is string => msg !== undefined)
    })
    .at(0)

/**
 * Validate that `agent` may read `table` for knowledge embedding
 *. Returns an error string on violation, or
 * `undefined` when access is permitted.
 *
 * The check applies to EVERY agent role. It used to open
 * `if (agent.role !== 'viewer') return undefined`, so a config naming a table
 * its agent could not read decoded cleanly and the entry was dropped later,
 * quietly, by `filterAgentKnowledgeTables` — no error, no log, no trace in the
 * config. Refusing the config here instead means `sovrium validate` catches it
 * without booting, and the message names both the agent and the table so the
 * author can act on it.
 *
 * KEEP IN LOCK-STEP with `canAgentReadKnowledgeTable` in
 * `src/domain/services/rag/rag-knowledge-access.ts`, which decides the same
 * question at ingest time; see the note there for why the two cannot share a
 * helper. `role` defaults to `member` for the same reason it does there.
 */
const validateKnowledgeTablePermission = (
  agent: NonNullable<AppKnowledgeShape['agents']>[number],
  table: string,
  read: unknown
): string | undefined => {
  const role = agent.role ?? 'member'
  const allowed = permits(
    evaluatePermission(
      toPermissionValue(read),
      { role },
      {
        whenUndeclared: ANY_NON_VIEWER_WHEN_UNDECLARED,
        adminOverride: 'admin-outranks-everything',
      }
    )
  )
  if (allowed) return undefined
  return `Agent '${agent.name}' (role '${role}') lacks read access permission to embed table '${table}' as knowledge. The agent's role does not satisfy the table's read RBAC.`
}

/**
 * Validate every agent's `knowledge.tables[]` entries against `app.tables`.
 *
 * Returns `true` when all references are valid, or a human-readable error
 * string describing the first violation (so `Schema.filter` surfaces a
 * useful message). The order matters for the spec regexes:
 *  - unknown table / field → `not found` / `does not exist`
 *  - non-text field type   → `field type` / `text` / `knowledge`
 */
export const validateAllKnowledgeReferences = (app: AppKnowledgeShape): true | string => {
  const agents = app.agents ?? []
  if (agents.length === 0) return true

  const tableMap: TableFieldMap = new Map(
    (app.tables ?? []).map((t) => [
      t.name,
      {
        fieldTypes: new Map(t.fields.map((f) => [f.name, f.type] as const)),
        read: t.permissions?.read,
      } satisfies KnowledgeTableMeta,
    ])
  )

  return agents.flatMap((agent) => validateAgentKnowledge(agent, tableMap) ?? []).at(0) ?? true
}
