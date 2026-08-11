/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { optionValue } from '@/domain/utils/select-option'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { escapeSqlString } from './sql-utils'
import type { Fields } from '@/domain/models/app/tables/fields'
import type { SelectOption } from '@/domain/models/app/tables/fields/field-types/validation-utils'

/**
 * Generate CHECK constraints for array fields with maxItems
 *
 * Dialect-aware: PostgreSQL uses `array_length(col, 1)` against native arrays;
 * SQLite stores arrays as JSON TEXT and uses `json_array_length(col)` from the
 * built-in JSON1 extension (always enabled in `bun:sqlite`). Both branches
 * preserve the `IS NULL OR …` shape so an unset column is allowed.
 */
export const generateArrayConstraints = (fields: readonly Fields[number][]): readonly string[] =>
  fields
    .filter(
      (field): field is Fields[number] & { type: 'array'; maxItems: number } =>
        field.type === 'array' && 'maxItems' in field && typeof field.maxItems === 'number'
    )
    .map((field) => {
      const lengthFn = isSqliteRuntime() ? 'json_array_length' : 'array_length'
      const callArgs = isSqliteRuntime() ? `(${field.name})` : `(${field.name}, 1)`
      return `CONSTRAINT check_${field.name}_max_items CHECK (${lengthFn}${callArgs} IS NULL OR ${lengthFn}${callArgs} <= ${field.maxItems})`
    })

/**
 * Generate CHECK constraints for multiple-attachments fields with maxFiles
 *
 * Dialect-aware: PostgreSQL `jsonb_array_length` operates on the native JSONB
 * column; SQLite has no JSONB type — the column stores JSON TEXT and
 * `json_array_length` (built-in JSON1, always enabled in `bun:sqlite`) returns
 * the array length over the parsed text. Semantically equivalent.
 */
export const generateMultipleAttachmentsConstraints = (
  fields: readonly Fields[number][]
): readonly string[] =>
  fields
    .filter(
      (field): field is Fields[number] & { type: 'multiple-attachments'; maxFiles: number } =>
        field.type === 'multiple-attachments' &&
        'maxFiles' in field &&
        typeof field.maxFiles === 'number'
    )
    .map((field) => {
      const lengthFn = isSqliteRuntime() ? 'json_array_length' : 'jsonb_array_length'
      return `CONSTRAINT check_${field.name}_max_files CHECK (${lengthFn}(${field.name}) IS NULL OR ${lengthFn}(${field.name}) <= ${field.maxFiles})`
    })

/**
 * Generate CHECK constraints for numeric fields with min/max values
 * Supports: integer, decimal, currency, percentage, rating
 */
export const generateNumericConstraints = (fields: readonly Fields[number][]): readonly string[] =>
  fields
    .filter(
      (
        field
      ): field is Fields[number] & {
        type: 'integer' | 'decimal' | 'currency' | 'percentage' | 'rating'
      } =>
        (field.type === 'integer' ||
          field.type === 'decimal' ||
          field.type === 'currency' ||
          field.type === 'percentage' ||
          field.type === 'rating') &&
        (('min' in field && typeof field.min === 'number') ||
          ('max' in field && typeof field.max === 'number'))
    )
    .map((field) => {
      const hasMin = 'min' in field && typeof field.min === 'number'
      const hasMax = 'max' in field && typeof field.max === 'number'

      // Rating fields always have a minimum of 1 (ratings start from 1, not 0)
      const effectiveMin = field.type === 'rating' && !hasMin ? 1 : hasMin ? field.min : undefined

      const conditions = [
        ...(effectiveMin !== undefined ? [`${field.name} >= ${effectiveMin}`] : []),
        ...(hasMax ? [`${field.name} <= ${field.max}`] : []),
      ]

      const constraintName = `check_${field.name}_range`
      const constraintCondition = conditions.join(' AND ')
      return `CONSTRAINT ${constraintName} CHECK (${constraintCondition})`
    })

/**
 * Generate CHECK constraints for progress fields (automatic 0-100 range)
 */
export const generateProgressConstraints = (fields: readonly Fields[number][]): readonly string[] =>
  fields
    .filter((field): field is Fields[number] & { type: 'progress' } => field.type === 'progress')
    .map((field) => {
      const constraintName = `check_${field.name}_range`
      return `CONSTRAINT ${constraintName} CHECK (${field.name} >= 0 AND ${field.name} <= 100)`
    })

/**
 * Extract string values from field options
 * Handles both simple string arrays (single-select) and object arrays with value property (status)
 */
const extractOptionValues = (
  field: Fields[number]
): readonly string[] | readonly { value: string }[] => {
  if ('options' in field && Array.isArray(field.options)) {
    return field.options as readonly string[] | readonly { value: string }[]
  }
  return []
}

/**
 * Generate CHECK constraint for enum-based fields (single-select, status)
 *
 * SECURITY NOTE: Options come from validated Effect Schema (SingleSelectFieldSchema, StatusFieldSchema).
 * We escape single quotes to prevent SQL injection following defense-in-depth security principles.
 *
 * DRY PRINCIPLE: This function consolidates enum constraint generation for both single-select
 * (simple string options) and status (object options with value property) field types.
 */
const generateEnumCheckConstraint = (
  field: Fields[number] & { readonly options: readonly unknown[] }
): string => {
  const options = extractOptionValues(field)
  const values = options
    // Normalize via the shared `optionValue` helper (bare string → itself,
    // `{ value, label? }` → value) so this enum path builds the member CHECK on
    // the stored VALUE exactly like `generateMultiSelectConstraints`, instead of
    // re-implementing the string-vs-object test inline.
    .map((opt) => `'${escapeSqlString(optionValue(opt))}'`)
    .join(', ')
  const constraintName = `check_${field.name}_enum`
  return `CONSTRAINT ${constraintName} CHECK (${field.name} IN (${values}))`
}

/**
 * Generate CHECK constraints for single-select fields with enum options
 */
export const generateEnumConstraints = (fields: readonly Fields[number][]): readonly string[] =>
  fields
    .filter(
      (field): field is Fields[number] & { type: 'single-select'; options: readonly string[] } =>
        field.type === 'single-select' && 'options' in field && Array.isArray(field.options)
    )
    .map(generateEnumCheckConstraint)

/**
 * Generate CHECK constraints for status fields with status options
 */
export const generateStatusConstraints = (fields: readonly Fields[number][]): readonly string[] =>
  fields
    .filter(
      (
        field
      ): field is Fields[number] & {
        type: 'status'
        options: readonly { value: string; color?: string }[]
      } => field.type === 'status' && 'options' in field && Array.isArray(field.options)
    )
    .map(generateEnumCheckConstraint)

/**
 * Generate CHECK constraints for rich-text fields with maxLength
 */
export const generateRichTextConstraints = (fields: readonly Fields[number][]): readonly string[] =>
  fields
    .filter(
      (field): field is Fields[number] & { type: 'rich-text'; maxLength: number } =>
        field.type === 'rich-text' && 'maxLength' in field && typeof field.maxLength === 'number'
    )
    .map((field) => {
      const constraintName = `check_${field.name}_max_length`
      return `CONSTRAINT ${constraintName} CHECK (LENGTH(${field.name}) <= ${field.maxLength})`
    })

/**
 * Barcode format validation patterns
 *
 * PostgreSQL uses ERE regex via the `~` operator; SQLite has no built-in regex
 * function but supports `GLOB` (POSIX glob) which can express the fixed-length
 * digit formats Sovrium needs. Each entry pairs the PG regex with a SQLite
 * GLOB pattern when one exists. CODE-128 / CODE-39 use character-class regex
 * features (ranges over hex-codepoints, optional metacharacters) that GLOB
 * cannot express; for those, SQLite falls back to a non-empty-string check
 * (`LENGTH(col) > 0`). This relaxes the constraint on SQLite for those two
 * formats — a documented partial-degradation, mirroring how the dialect
 * provider already degrades pgvector / GIN tsvector to no-op on SQLite.
 */
const barcodeFormatPgPatterns: Record<string, string> = {
  'EAN-13': '^[0-9]{13}$',
  'EAN-8': '^[0-9]{8}$',
  'UPC-A': '^[0-9]{12}$',
  'UPC-E': '^[0-9]{6,8}$',
  'CODE-128': '^[\\x00-\\x7F]+$',
  'CODE-39': '^[A-Z0-9\\-\\.\\$\\/\\+\\%\\ ]+$',
}

/**
 * SQLite GLOB equivalents for fixed-length barcode formats. The `[0-9]` glob
 * class behaves identically to the regex character class for digit ranges.
 * UPC-E is variable-length (6 to 8 digits) — modeled as a 3-OR predicate. The
 * `undefined` entries trigger the LENGTH-only fallback above.
 */
const barcodeFormatSqliteGlobs: Record<string, string | undefined> = {
  'EAN-13': '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]',
  'EAN-8': '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]',
  'UPC-A': '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]',
  // CODE-128 / CODE-39 / UPC-E: no exact GLOB equivalent (character-class or
  // length-range semantics outside POSIX glob) — fallback below.
}

/**
 * Generate CHECK constraints for barcode fields with format validation.
 *
 * Dialect-aware: PostgreSQL uses regex `~` against the patterns above; SQLite
 * uses GLOB for the fixed-digit formats and falls back to a non-empty check
 * for the formats where GLOB cannot express the regex. Returns `''` when the
 * format is not recognized at all (filtered out at the end).
 */
export const generateBarcodeConstraints = (fields: readonly Fields[number][]): readonly string[] =>
  fields
    .filter(
      (field): field is Fields[number] & { type: 'barcode'; format: string } =>
        field.type === 'barcode' && 'format' in field && typeof field.format === 'string'
    )
    .map((field) => {
      const constraintName = `check_${field.name}_format`
      if (isSqliteRuntime()) {
        // Unknown format: same drop-the-constraint behavior as PG path below.
        if (!(field.format in barcodeFormatPgPatterns)) return ''
        const glob = barcodeFormatSqliteGlobs[field.format]
        if (glob !== undefined) {
          return `CONSTRAINT ${constraintName} CHECK (${field.name} GLOB '${glob}')`
        }
        // No GLOB representation for this regex — partial degradation: require
        // non-empty. Documented above; tests pin both PG (strict) and SQLite
        // (relaxed) semantics.
        return `CONSTRAINT ${constraintName} CHECK (LENGTH(${field.name}) > 0)`
      }
      const pattern = barcodeFormatPgPatterns[field.format]
      if (!pattern) return ''
      return `CONSTRAINT ${constraintName} CHECK (${field.name} ~ '${pattern}')`
    })
    .filter((constraint) => constraint !== '')

/**
 * Generate CHECK constraints for color fields with hex color format validation.
 *
 * Dialect-aware: PostgreSQL uses regex `~ '^#[0-9a-fA-F]{6}$'`; SQLite has no
 * regex but the hex-color shape is expressible as a GLOB with six explicit
 * character classes — `[0-9A-Fa-f]` is identical syntax in both POSIX glob
 * and ERE regex character classes.
 */
export const generateColorConstraints = (fields: readonly Fields[number][]): readonly string[] =>
  fields
    .filter((field): field is Fields[number] & { type: 'color' } => field.type === 'color')
    .map((field) => {
      const constraintName = `check_${field.name}_format`
      if (isSqliteRuntime()) {
        return `CONSTRAINT ${constraintName} CHECK (${field.name} GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')`
      }
      return `CONSTRAINT ${constraintName} CHECK (${field.name} ~ '^#[0-9a-fA-F]{6}$')`
    })

/**
 * Generate CHECK constraints for multi-select fields with options.
 *
 * Validates that all selected values are members of the predefined options.
 *
 * Dialect-aware:
 * - PostgreSQL: uses the native array containment operator
 *   `${name} <@ ARRAY[...]::text[]` over the native text[] column.
 * - SQLite: the constraint is **dropped on SQLite** (partial degradation).
 *   SQLite stores the multi-select column as JSON TEXT (no native array),
 *   so a membership check must compare every JSON-array element against the
 *   option allowlist. The semantically-equivalent SQL idiom —
 *   `NOT EXISTS (SELECT 1 FROM json_each(col) WHERE value NOT IN (…))` —
 *   uses a **subquery**, which SQLite explicitly prohibits inside CHECK
 *   constraints (raises `subqueries prohibited in CHECK constraints` at
 *   table-create time). No subquery-free SQL idiom expresses "every element
 *   of a JSON array is in a fixed allowlist" on SQLite, and no approximation
 *   is sound: a `LIKE`/`GLOB` probe can only ask whether SOME element looks
 *   like a member, never whether EVERY element is one. Matches the
 *   established degradation pattern (CODE-128 barcode regex, pgvector, GIN
 *   tsvector).
 *
 * CORRECTION (was load-bearing, and wrong): this comment previously justified
 * the SQLite drop by asserting that "application-layer validation already
 * enforces this rule on writes (via the multi-select field's Effect Schema
 * decoder)". It did not, and that false claim is the reason the gap survived.
 * `multi-select-field.ts` validates the field CONFIG only (`maxSelections <=
 * options.length`) and never sees a record value, so an undeclared option was
 * 201-and-persisted on SQLite through the records API. The enforcement the
 * comment described now genuinely exists, but somewhere else and with a
 * narrower reach: `domain/validators/multi-select-values.ts`, run by the
 * records-API create and update paths.
 *
 * That rule is the PRIMARY guard on SQLite (there is no other) and this CHECK
 * is defence in depth on PostgreSQL. Neither covers the write paths that
 * bypass the records-API validation chain — batch create/update, upsert,
 * bulk/HTML-form update, MCP tools, and automation record actions — which
 * remain unguarded on both engines. Do not restore a blanket claim of
 * application-layer coverage here without checking those callers.
 *
 * @example
 * Field: { type: 'multi-select', options: ['work', 'personal'] }
 * PG:     CHECK (tags <@ ARRAY['work', 'personal']::text[])
 * SQLite: <constraint omitted; validation happens in the application layer>
 */
export const generateMultiSelectConstraints = (
  fields: readonly Fields[number][]
): readonly string[] =>
  fields
    .filter(
      (
        field
      ): field is Fields[number] & { type: 'multi-select'; options: readonly SelectOption[] } =>
        field.type === 'multi-select' && 'options' in field && Array.isArray(field.options)
    )
    .flatMap((field) => {
      // SQLite: drop the constraint entirely (subqueries are prohibited in
      // CHECK; no subquery-free equivalent exists). Application-layer
      // validation enforces the rule on writes.
      if (isSqliteRuntime()) return []
      // Options may be bare strings OR `{ value, label }` objects — normalize via
      // `optionValue` so the member CHECK is built on the stored VALUE (an object
      // option's display label is never a valid member). Mirrors the single-select
      // path (`generateEnumCheckConstraint`, which is already object-aware).
      const escapedOptions = field.options
        .map((opt) => `'${escapeSqlString(optionValue(opt))}'`)
        .join(', ')
      const constraintName = `check_${field.name}_options`
      return [
        `CONSTRAINT ${constraintName} CHECK (${field.name} <@ ARRAY[${escapedOptions}]::text[])`,
      ]
    })

/**
 * Generate custom CHECK constraints defined at table level
 *
 * Used for complex business rules that involve multiple fields or
 * conditional validation beyond field-level constraints.
 *
 * @example
 * ```typescript
 * const constraints = [{
 *   name: 'chk_active_members_have_email',
 *   check: '(is_active = false) OR (email IS NOT NULL)'
 * }]
 * ```
 */
export const generateCustomCheckConstraints = (
  constraints?: readonly { readonly name: string; readonly check: string }[]
): readonly string[] =>
  constraints
    ? constraints.map((constraint) => `CONSTRAINT ${constraint.name} CHECK (${constraint.check})`)
    : []
