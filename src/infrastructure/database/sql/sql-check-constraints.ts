/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeSqlString } from './sql-utils'
import type { Fields } from '@/domain/models/app/tables/fields'

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

      const effectiveMin = field.type === 'rating' && !hasMin ? 1 : hasMin ? field.min : undefined

      const conditions = [
        ...(effectiveMin !== undefined ? [`${field.name} >= ${effectiveMin}`] : []),
        ...(hasMax ? [`${field.name} <= ${field.max}`] : []),
      ]

      const constraintName = `check_${field.name}_range`
      const constraintCondition = conditions.join(' AND ')
      return `CONSTRAINT ${constraintName} CHECK (${constraintCondition})`
    })

export const generateProgressConstraints = (fields: readonly Fields[number][]): readonly string[] =>
  fields
    .filter((field): field is Fields[number] & { type: 'progress' } => field.type === 'progress')
    .map((field) => {
      const constraintName = `check_${field.name}_range`
      return `CONSTRAINT ${constraintName} CHECK (${field.name} >= 0 AND ${field.name} <= 100)`
    })

const extractOptionValues = (
  field: Fields[number]
): readonly string[] | readonly { value: string }[] => {
  if ('options' in field && Array.isArray(field.options)) {
    return field.options as readonly string[] | readonly { value: string }[]
  }
  return []
}

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

export const generateEnumConstraints = (fields: readonly Fields[number][]): readonly string[] =>
  fields
    .filter(
      (field): field is Fields[number] & { type: 'single-select'; options: readonly string[] } =>
        field.type === 'single-select' && 'options' in field && Array.isArray(field.options)
    )
    .map(generateEnumCheckConstraint)

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

const barcodeFormatPatterns: Record<string, string> = {
  'EAN-13': '^[0-9]{13}$',
  'EAN-8': '^[0-9]{8}$',
  'UPC-A': '^[0-9]{12}$',
  'UPC-E': '^[0-9]{6,8}$',
  'CODE-128': '^[\\x00-\\x7F]+$',
  'CODE-39': '^[A-Z0-9\\-\\.\\$\\/\\+\\%\\ ]+$',
}

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

export const generateColorConstraints = (fields: readonly Fields[number][]): readonly string[] =>
  fields
    .filter((field): field is Fields[number] & { type: 'color' } => field.type === 'color')
    .map((field) => {
      const constraintName = `check_${field.name}_format`
      return `CONSTRAINT ${constraintName} CHECK (${field.name} ~ '^#[0-9a-fA-F]{6}$')`
    })

export const generateMultiSelectConstraints = (
  fields: readonly Fields[number][]
): readonly string[] =>
  fields
    .filter(
      (field): field is Fields[number] & { type: 'multi-select'; options: readonly string[] } =>
        field.type === 'multi-select' && 'options' in field && Array.isArray(field.options)
    )
    .map((field) => {
      const escapedOptions = field.options.map((opt) => `'${escapeSqlString(opt)}'`).join(', ')
      const constraintName = `check_${field.name}_options`
      return `CONSTRAINT ${constraintName} CHECK (${field.name} <@ ARRAY[${escapedOptions}]::text[])`
    })

export const generateCustomCheckConstraints = (
  constraints?: readonly { readonly name: string; readonly check: string }[]
): readonly string[] =>
  constraints
    ? constraints.map((constraint) => `CONSTRAINT ${constraint.name} CHECK (${constraint.check})`)
    : []
