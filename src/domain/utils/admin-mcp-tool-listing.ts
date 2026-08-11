/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure, display-only MCP tool listing for the admin dashboard's **MCP** docs
 * page ([internal ref] / system docs).
 *
 * The MCP server (`/mcp`) exposes a config-derived tool catalog: one tool per
 * `(table, operation)` pair, per action template, and per manual-trigger
 * automation that opts into `aiAccess`. The authoritative wire-format compiler
 * is `src/infrastructure/server/route-setup/mcp/tool-compiler.ts` (`compileMcpTools`),
 * but that lives in the infrastructure layer and emits full JSON-Schema input
 * shapes. The MCP docs PAGE only needs to *show the operator which tools their
 * config exposes* — names + a one-line description + a category — so this domain
 * util re-derives the same `name` convention without the wire-format weight, and
 * is therefore safe to import from the application surface builder (which may not
 * reach into infrastructure).
 *
 * It is intentionally a faithful name-mirror of `compileMcpTools`: the tool
 * `name`s here MUST match what the server actually advertises, so an operator
 * reading the docs and an AI reading `tools/list` see the same identifiers.
 */

import {
  buildActionToolDescription,
  buildAutomationToolDescription,
  buildTableToolDescription,
  isAiAccessEnabled,
} from '@/domain/models/shared/ai-access'
import type { App } from '@/domain/models/app'
import type { AiAccess, AiAccessOperation } from '@/domain/models/shared/ai-access'

/** The five CRUD operations a table exposes to MCP when `aiAccess` is on (default set). */
const DEFAULT_TABLE_OPERATIONS: ReadonlyArray<AiAccessOperation> = [
  'read',
  'list',
  'create',
  'update',
  'delete',
]

/** The display category a tool belongs to (drives the docs-page grouping). */
export type McpToolCategory = 'table' | 'action' | 'automation'

/** One config-derived MCP tool, projected for display on the MCP docs page. */
export interface McpToolListing {
  /** The exact tool name the server advertises (`{appName}_{...}`). */
  readonly name: string
  /** Which config entity the tool derives from — drives the docs-page grouping. */
  readonly category: McpToolCategory
  /** A short, human-readable description of what the tool does. */
  readonly description: string
}

/** Resolve a table's exposed operations (declared subset, else all five CRUD verbs). */
function resolveOperations(access: AiAccess | undefined): ReadonlyArray<AiAccessOperation> {
  if (access === undefined || typeof access === 'boolean') return DEFAULT_TABLE_OPERATIONS
  return access.operations ?? DEFAULT_TABLE_OPERATIONS
}

/**
 * Mirror `compileMcpTools`' table-tool naming + description.
 *
 * The description comes from the SHARED {@link buildTableToolDescription} the
 * wire compiler also calls, because this listing's whole job is to show the
 * operator what their AI client actually receives. A description that reads
 * well here but differs from the wire is worse than no listing at all — which
 * is exactly what happened while this function inlined the default sentence and
 * silently dropped the author's `aiAccess.description` override.
 */
function listTableTools(appName: string, app: App): ReadonlyArray<McpToolListing> {
  return (app.tables ?? []).flatMap((table) => {
    if (!isAiAccessEnabled(table.aiAccess)) return []
    return resolveOperations(table.aiAccess).map((operation) => ({
      name: `${appName}_${table.name}_${operation}`,
      category: 'table' as const,
      description: buildTableToolDescription(table.name, operation, table.aiAccess),
    }))
  })
}

/** Mirror `compileMcpTools`' action-template naming + description (identical to the wire). */
function listActionTools(appName: string, app: App): ReadonlyArray<McpToolListing> {
  return (app.actions ?? []).flatMap((template) => {
    if (!isAiAccessEnabled(template.aiAccess)) return []
    return [
      {
        name: `${appName}_action_${template.name}`,
        category: 'action' as const,
        description: buildActionToolDescription(template.name, template.aiAccess),
      },
    ]
  })
}

/** Mirror `compileMcpTools`' automation naming (manual triggers only) + description. */
function listAutomationTools(appName: string, app: App): ReadonlyArray<McpToolListing> {
  return (app.automations ?? []).flatMap((automation) => {
    if (!isAiAccessEnabled(automation.aiAccess)) return []
    if (automation.trigger.type !== 'manual') return []
    return [
      {
        name: `${appName}_automation_${automation.name}`,
        category: 'automation' as const,
        description: buildAutomationToolDescription(automation.name, automation.aiAccess),
      },
    ]
  })
}

/**
 * List the MCP tools the running app config exposes, in the same source order
 * the server compiles them (tables → actions → automations). Returns an empty
 * array when no config entity opts into `aiAccess` — the docs page renders its
 * "no tools exposed yet" guidance state in that case.
 *
 * The tool `name`s are a faithful mirror of
 * `compileMcpTools` (`infrastructure/.../mcp/tool-compiler.ts`) so the docs an
 * operator reads match the identifiers an AI discovers over `tools/list`.
 */
export function listMcpTools(app: App): ReadonlyArray<McpToolListing> {
  const appName = app.name
  return [
    ...listTableTools(appName, app),
    ...listActionTools(appName, app),
    ...listAutomationTools(appName, app),
  ]
}
