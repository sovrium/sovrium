/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeSqlString } from './sql-utils'
import type { Fields } from '@/domain/models/app/table/fields'

/**
 * Generate CHECK constraints for array fields with maxItems
 */
export const generateArrayConstraints = (fields: readonly Fields[number][]): readonly string[] =>
  fields
    .filter(
      (field): field is Fields[number] & { type: 'array'; maxItems: number } =>
        field.type === 'array' && 'maxItems' in field && typeof field.maxItems === 'number'
    )
    .map(
      (field) =>
        `CONSTRAINT check_${field.name}_max_items CHECK (array_length(${field.name}, 1) IS NULL OR array_length(${field.name}, 1) <= ${field.maxItems})`
    )

/**
 * Generate CHECK constraints for multiple-attachments fields with maxFiles
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
    .map(
      (field) =>
        `CONSTRAINT check_${field.name}_max_files CHECK (jsonb_array_length(${field.name}) IS NULL OR jsonb_array_length(${field.name}) <= ${field.maxFiles})`
    )

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
    .map((opt) => {
      const value = typeof opt === 'string' ? opt : (opt as { value: string }).value
      return `'${escapeSqlString(value)}'`
    })
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
 * Uses PostgreSQL regex patterns to validate barcode formats
 */
const barcodeFormatPatterns: Record<string, string> = {
  'EAN-13': '^[0-9]{13}$',
  'EAN-8': '^[0-9]{8}$',
  'UPC-A': '^[0-9]{12}$',
  'UPC-E': '^[0-9]{6,8}$',
  'CODE-128': '^[\\x00-\\x7F]+$',
  'CODE-39': '^[A-Z0-9\\-\\.\\$\\/\\+\\%\\ ]+$',
}

/**
 * Generate CHECK constraints for barcode fields with format validation
 */
export const generateBarcodeConstraints = (fields: readonly Fields[number][]): readonly string[] =>
  fields
    .filter(
      (field): field is Fields[number] & { type: 'barcode'; format: string } =>
        field.type === 'barcode' && 'format' in field && typeof field.format === 'string'
    )
    .map((field) => {
      const pattern = barcodeFormatPatterns[field.format]
      if (!pattern) {
        return ''
      }
      const constraintName = `check_${field.name}_format`
      return `CONSTRAINT ${constraintName} CHECK (${field.name} ~ '${pattern}')`
    })
    .filter((constraint) => constraint !== '')

/**
 * Generate CHECK constraints for color fields with hex color format validation
 */
export const generateColorConstraints = (fields: readonly Fields[number][]): readonly string[] =>
  fields
    .filter((field): field is Fields[number] & { type: 'color' } => field.type === 'color')
    .map((field) => {
      const constraintName = `check_${field.name}_format`
      return `CONSTRAINT ${constraintName} CHECK (${field.name} ~ '^#[0-9a-fA-F]{6}$')`
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
