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
  readonly columns: ReadonlyArray<string>
}

export const MAX_QUERY_ROWS = 100

export const TOOL_FILTER_OPERATORS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'startsWith',
  'endsWith',
  'in',
  'isNull',
  'isNotNull',
] as const

const buildQueryParameters = (columns: ReadonlyArray<string>): Record<string, unknown> => {
  const columnEnum = [...columns]
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      select: {
        type: 'array',
        description: 'Columns to return. Omit for all readable columns.',
        items: { type: 'string', enum: columnEnum },
      },
      filters: {
        type: 'array',
        description: 'Equality / comparison filters combined with AND.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            field: { type: 'string', enum: columnEnum },
            operator: { type: 'string', enum: [...TOOL_FILTER_OPERATORS] },
            value: {
              description: 'The value to compare against (bound as a parameter).',
            },
          },
          required: ['field', 'operator'],
        },
      },
      sort: {
        type: 'object',
        additionalProperties: false,
        properties: {
          field: { type: 'string', enum: columnEnum },
          direction: { type: 'string', enum: ['asc', 'desc'] },
        },
        required: ['field'],
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: MAX_QUERY_ROWS,
        description: `Maximum rows to return (1..${MAX_QUERY_ROWS}, default 50).`,
      },
    },
  }
}

const buildCountParameters = (columns: ReadonlyArray<string>): Record<string, unknown> => {
  const columnEnum = [...columns]
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      filters: {
        type: 'array',
        description: 'Equality / comparison filters combined with AND.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            field: { type: 'string', enum: columnEnum },
            operator: { type: 'string', enum: [...TOOL_FILTER_OPERATORS] },
            value: { description: 'The value to compare against (bound as a parameter).' },
          },
          required: ['field', 'operator'],
        },
      },
    },
  }
}

export const buildChatToolDefinitions = (
  tables: ReadonlyArray<ToolableTable>
): ReadonlyArray<ChatToolDefinition> =>
  tables.flatMap((table) => [
    {
      type: 'function' as const,
      function: {
        name: `query_${table.name}`,
        description: `Read records from the "${table.name}" table with structured filters, column selection, sorting, and a row limit. Read-only.`,
        parameters: buildQueryParameters(table.columns),
      },
    },
    {
      type: 'function' as const,
      function: {
        name: `count_${table.name}`,
        description: `Count records in the "${table.name}" table, optionally narrowed by structured filters. Read-only.`,
        parameters: buildCountParameters(table.columns),
      },
    },
  ])
