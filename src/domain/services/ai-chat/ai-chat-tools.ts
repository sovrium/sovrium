/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AI Chat function/tool-definition builder.
 *
 * Pure domain helper backing `[internal ref]`
 *. Given the set of tables the acting user may
 * reason about, it produces the OpenAI-compatible `tools[]` array the chat
 * route advertises to the AI provider so the model can request a tool call.
 *
 * SECURITY (Finding #1): the AI chat NO LONGER advertises a free-form SQL
 * string. Each accessible table yields a `query_<table>` tool whose parameters
 * are a STRUCTURED schema scoped to that table's own ROLE-READABLE columns —
 * `select` / `filters` / `sort` / `limit`. Because there is no table-name
 * argument and `select`/`filters[].field`/`sort.field` are enums of the
 * table's own readable columns, cross-table reads are structurally impossible
 * and the model can never express a write/DDL. The server (chat-tool-calling.ts)
 * re-validates the structured args as the security boundary and translates them
 * into the safe, parameterized query builder.
 *
 * A companion `count_<table>` tool preserves the headline counting use-case the
 * old free-SQL `SELECT COUNT(*)` provided, via the
 * repository `count` method.
 *
 * Tables the caller cannot read are never passed in by the route, so the
 * produced tool list naturally respects table-level RBAC
 *: there is simply no tool for an unauthorized table.
 * Field-level read restrictions narrow each tool's column enums
 *.
 *
 * This module is pure (no I/O, no `App` import) so it can be unit-tested in
 * isolation and reused by both the generic and agent-bound chat paths.
 */

/**
 * A single function/tool definition advertised to the AI provider — the
 * OpenAI-compatible `tools[]` entry. Carries the function name, a description
 * the model uses to decide when to call it, and a JSON-Schema `parameters`
 * object constraining the arguments.
 *
 * Defined here in the domain layer (rather than the `AiService` port) so this
 * pure builder owns the tool-definition shape; the application port re-uses
 * this type for its `ChatInput.tools` field.
 */
export interface ChatToolDefinition {
  readonly type: 'function'
  readonly function: {
    readonly name: string
    readonly description: string
    readonly parameters: Record<string, unknown>
  }
}

/** The minimal table shape the structured tool builder consumes. */
export interface ToolableTable {
  /** Table name — drives the emitted `query_<name>` / `count_<name>` tool names. */
  readonly name: string
  /**
   * The role-readable column names for this table — the enum that scopes
   * `select`, `filters[].field`, and `sort.field`. Excludes any column the
   * acting role cannot read (field-level RBAC). May be empty.
   */
  readonly columns: ReadonlyArray<string>
}

/** Hard ceiling on the `limit` advertised in the tool schema. The server clamps too. */
export const MAX_QUERY_ROWS = 100

/**
 * The structured filter operators advertised to the model. These are the
 * AI-facing operator tokens; the server maps them to the internal
 * `generateSqlConditionFragment` vocabulary
 * (`eq→equals`, `neq→notEquals`, `gt→greaterThan`, …). Read-only by
 * construction — there is no mutate/DDL operator.
 */
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

/**
 * Build the JSON-Schema `parameters` object for a `query_<table>` tool, scoped
 * to the table's role-readable columns. `select` / `filters[].field` /
 * `sort.field` are enums of those columns so the model is steered to valid args
 * (the server still re-validates as the security boundary).
 */
const buildQueryParameters = (
  columns: ReadonlyArray<string>
): Readonly<Record<string, unknown>> => {
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

/**
 * Build the JSON-Schema `parameters` object for a `count_<table>` tool. Counting
 * accepts only an optional `filters` array (same shape as the query tool); an
 * empty / filter-only args object counts all readable rows.
 */
const buildCountParameters = (
  columns: ReadonlyArray<string>
): Readonly<Record<string, unknown>> => {
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

/**
 * Build the OpenAI-compatible `tools[]` array for a set of accessible tables.
 *
 * Each table yields TWO structured, read-only tools scoped to its own
 * role-readable columns: a `query_<table>` (select/filters/sort/limit) and a
 * `count_<table>` (filters only). No table-name argument exists, so a tool can
 * only ever read its own table.
 *
 * @param tables — Tables the acting principal may read, each carrying its
 *   role-readable `columns`. An empty list yields an empty tool array.
 */
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
