/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The built-in System Agent every app carries without declaring it.
 *
 * It is not a declaration: nothing about it is authored, so nothing about it
 * can drift from the app. Its prompt is generated from the app's own name,
 * description and tables on every turn; its tools are the chat's structured
 * READ tools (`query_<table>` / `count_<table>`), scoped to the CALLER's
 * permissions by the presentation layer; and it never writes — neither records
 * nor configuration.
 *
 * This module is pure: it turns the app's identity and the tables a caller may
 * read into an `Agent`-shaped value. Which tables a caller may read is decided
 * by the permission evaluator at the edge, then handed in.
 */

import { SYSTEM_AGENT_NAME } from './agent-identity'
import type { Agent } from './agent'

/**
 * The role the System Agent is described with. Informational only: its tools
 * and prompt are scoped to the caller's own permissions, never to this role —
 * a member talking to it reads exactly what a member may read.
 */
const SYSTEM_AGENT_ROLE = 'admin'

/** The minimal shape of a table the System Agent's prompt describes. */
export interface SystemAgentTable {
  readonly name: string
  readonly fields: ReadonlyArray<{ readonly name: string }>
}

/** The app identity the System Agent's prompt is built from. */
export interface SystemAgentApp {
  readonly name: string
  readonly description?: string
}

/** One line per readable table: its name and its field names. */
const renderTables = (tables: ReadonlyArray<SystemAgentTable>): string =>
  tables.length === 0
    ? 'The caller cannot read any data table in this app.'
    : [
        'Data tables the caller can read:',
        ...tables.map(
          (table) => `- ${table.name} (fields: ${table.fields.map((f) => f.name).join(', ')})`
        ),
      ].join('\n')

/**
 * Compose the System Agent's prompt for one turn.
 *
 * `tables` are the tables the CALLER may read — the prompt never names a table
 * the caller could not query, so it cannot leak a table's existence either.
 */
export const buildSystemAgentPrompt = (
  app: SystemAgentApp,
  tables: ReadonlyArray<SystemAgentTable>
): string =>
  [
    `You are the System Agent of the "${app.name}" application, built into Sovrium.`,
    ...(app.description !== undefined && app.description.trim().length > 0
      ? [`About this application: ${app.description}`]
      : []),
    'You answer questions about this application and its data. You can read records through the query and count tools you are offered; you cannot create, update or delete records, and you cannot change the application configuration. When asked to change something, explain that you can only read.',
    renderTables(tables),
  ].join('\n\n')

/**
 * The System Agent as an `Agent`-shaped value, for the tables the caller may
 * read. Its name is the reserved {@link SYSTEM_AGENT_NAME}, which no app may
 * declare.
 */
export const buildSystemAgent = (
  app: SystemAgentApp,
  tables: ReadonlyArray<SystemAgentTable>
): Agent => ({
  name: SYSTEM_AGENT_NAME,
  role: SYSTEM_AGENT_ROLE,
  systemPrompt: buildSystemAgentPrompt(app, tables),
})
