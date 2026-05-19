/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface ChatToolDefinition {
  readonly type: 'function'
  readonly function: {
    readonly name: string
    readonly description: string
    readonly parameters: Record<string, unknown>
  }
}

export interface ToolableTable {
  readonly name: string
}

export const buildChatToolDefinitions = (
  tables: ReadonlyArray<ToolableTable>
): ReadonlyArray<ChatToolDefinition> =>
  tables.map((table) => ({
    type: 'function' as const,
    function: {
      name: `query_${table.name}`,
      description: `Run a read-only SQL SELECT query against the "${table.name}" table to read its records.`,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: `A read-only SQL SELECT statement against the "${table.name}" table.`,
          },
        },
        required: ['query'],
      },
    },
  }))
