/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Common SQL/formula keywords and functions organized by category.
 * These should be excluded from field references when parsing formulas.
 *
 * Defined as constants to avoid recreating Sets on every function call.
 * Exported from a separate module to reduce main table index file size.
 */

// ============================================================================
// SQL Keywords
// ============================================================================

/**
 * SQL keywords used in queries (SELECT, JOIN, WHERE, etc.)
 */
export const SQL_KEYWORDS: ReadonlySet<string> = new Set([
  'as',
  'from',
  'where',
  'on',
  'join',
  'left',
  'right',
  'inner',
  'outer',
  'distinct',
  'all',
  'any',
  'some',
  'between',
  'in',
  'like',
  'ilike',
  'is',
  'to',
  'for',
  'with',
  'desc',
  'asc',
  'by',
  'order',
  'group',
  'having',
  'limit',
  'offset',
  'select',
])

/**
 * Logical operators for boolean expressions
 */
export const LOGICAL_OPERATORS: ReadonlySet<string> = new Set([
  'if',
  'then',
  'else',
  'and',
  'or',
  'not',
])

/**
 * Boolean and null literals
 */
export const LITERALS: ReadonlySet<string> = new Set(['true', 'false', 'null'])

/**
 * Control flow keywords (CASE/WHEN/END)
 */
export const CONTROL_FLOW: ReadonlySet<string> = new Set(['case', 'when', 'end'])

// ============================================================================
// Functions by Category
// ============================================================================

/**
 * String manipulation functions
 */
export const STRING_FUNCTIONS: ReadonlySet<string> = new Set([
  'concat',
  'upper',
  'lower',
  'trim',
  'length',
  'substr',
  'substring',
  'replace',
  'overlay',
  'repeat',
  'strpos',
  'string_to_array',
  'array_to_string',
  'chr',
  'ascii',
  'encode',
  'decode',
  'initcap',
  'placing',
])

/**
 * Mathematical functions
 */
export const MATH_FUNCTIONS: ReadonlySet<string> = new Set([
  'round',
  'ceil',
  'floor',
  'abs',
  'power',
  'sqrt',
  'mod',
  'greatest',
  'least',
  'exp',
  'trunc',
  'log',
  'ln',
  'sign',
])

/**
 * Aggregate functions for grouping operations
 */
export const AGGREGATE_FUNCTIONS: ReadonlySet<string> = new Set([
  'sum',
  'avg',
  'max',
  'min',
  'count',
  'counta',
  'countall',
])

/**
 * Date and time functions
 */
export const DATE_FUNCTIONS: ReadonlySet<string> = new Set([
  'current_date',
  'current_time',
  'current_timestamp',
  'now',
  'extract',
  'date_add',
  'date_sub',
  'date_diff',
  'date_trunc',
  'to_char',
  'to_date',
  'to_timestamp',
  'age',
  'year',
  'month',
  'day',
  'hour',
  'minute',
  'second',
])

/**
 * Date part keywords used with EXTRACT
 */
export const DATE_PART_KEYWORDS: ReadonlySet<string> = new Set([
  'dow',
  'week',
  'doy',
  'epoch',
  'isodow',
  'isoweek',
  'isoyear',
  'julian',
  'quarter',
  'timezone',
])

/**
 * Type conversion functions
 */
export const TYPE_CONVERSIONS: ReadonlySet<string> = new Set(['cast', 'coalesce', 'nullif'])

/**
 * PostgreSQL data type names
 */
export const DATA_TYPES: ReadonlySet<string> = new Set([
  'numeric',
  'integer',
  'int',
  'decimal',
  'text',
  'varchar',
  'char',
  'boolean',
  'bool',
  'date',
  'timestamp',
  'timestamptz',
  'time',
  'interval',
  'bytea',
])

/**
 * Array manipulation functions
 */
export const ARRAY_FUNCTIONS: ReadonlySet<string> = new Set([
  'array',
  'array_length',
  'array_remove',
  'cardinality',
  'arrayunique',
  'unnest',
  'flatten',
])

/**
 * Regular expression functions
 */
export const REGEX_FUNCTIONS: ReadonlySet<string> = new Set(['regexp_match', 'regexp_replace'])

/**
 * Binary and encoding functions
 */
export const BINARY_FUNCTIONS: ReadonlySet<string> = new Set(['convert_from'])

// ============================================================================
// Combined Export (Backward Compatible)
// ============================================================================

/**
 * All formula keywords combined.
 * This is the main export for backward compatibility.
 *
 * Used to filter out SQL keywords when extracting field references from formulas.
 */
export const FORMULA_KEYWORDS = new Set([
  ...SQL_KEYWORDS,
  ...LOGICAL_OPERATORS,
  ...LITERALS,
  ...CONTROL_FLOW,
  ...STRING_FUNCTIONS,
  ...MATH_FUNCTIONS,
  ...AGGREGATE_FUNCTIONS,
  ...DATE_FUNCTIONS,
  ...DATE_PART_KEYWORDS,
  ...TYPE_CONVERSIONS,
  ...DATA_TYPES,
  ...ARRAY_FUNCTIONS,
  ...REGEX_FUNCTIONS,
  ...BINARY_FUNCTIONS,
])

// ============================================================================
// Category Groups for Programmatic Access
// ============================================================================

/**
 * All keyword categories for programmatic iteration
 */
export const KEYWORD_CATEGORIES = {
  SQL_KEYWORDS,
  LOGICAL_OPERATORS,
  LITERALS,
  CONTROL_FLOW,
  STRING_FUNCTIONS,
  MATH_FUNCTIONS,
  AGGREGATE_FUNCTIONS,
  DATE_FUNCTIONS,
  DATE_PART_KEYWORDS,
  TYPE_CONVERSIONS,
  DATA_TYPES,
  ARRAY_FUNCTIONS,
  REGEX_FUNCTIONS,
  BINARY_FUNCTIONS,
} as const
