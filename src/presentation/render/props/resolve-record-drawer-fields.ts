/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { declaredFieldDescription, declaredFieldLabel } from '@/presentation/design/field-display'
import { readColumnOptions } from '@/presentation/render/forms/form-field-resolver'
import { resolveOptionBadgePaints, type OptionBadgePaints } from './option-badge-paints'
import { resolveValueCurrency } from './resolve-chart-field-context'
import { resolveSourceTable } from './resolve-type-specific-inputs'
import type { CurrencyDisplayOptions } from '@/domain/kernel/format/currency-format'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'
import type { BadgeForm } from '@/presentation/design/option-chip-paint'

/** One control per declared field — the shape the record-drawer binds inputs to. */
export type DerivedRecordField = {
  readonly name: string
  readonly type: string
  /** Resolved display name for the panel entry; absent means "keep the raw name". */
  readonly label?: string
  /** Resolved guidance rendered beside the entry's value; absent means none. */
  readonly description?: string
  /** The bound column's declared currency display; absent when it declares none. */
  readonly currency?: CurrencyDisplayOptions
  /** A date / datetime column's `weekday`, printed before the date it reads. */
  readonly weekday?: 'short' | 'long'
  /** A datetime column's own `timeZone`, which the drawer reads before the operator zone. */
  readonly timeZone?: string
  /** A status / single-select column's options, for the editable drawer's choice. */
  readonly options?: ReadonlyArray<{ readonly value: string; readonly label: string }>
  /**
   * A status / single-select column's `value → paint` map, resolved here as
   * the grid's pill paints them, so a read-only drawer draws the same badge.
   * Only options that declare a colour are listed.
   */
  readonly paints?: OptionBadgePaints
  /** An attachment column's upload target and constraints, for the editable drawer's picker. */
  readonly bucket?: string
  readonly allowedFileTypes?: readonly string[]
  readonly maxFileSize?: number
  /** A single-valued relationship's related table, searched by the drawer's picker. */
  readonly relatedTable?: string
  /** The related table's field the picker names each linked record by. */
  readonly displayField?: string
  /**
   * Whether the column must hold a value: the editable drawer refuses it blank,
   * and an optional link offers a Clear control.
   */
  readonly required?: boolean
}

/**
 * The `relationship` overlay of one entry: a single-valued link's related
 * table and `displayField`, so an editable drawer offers the link as a search
 * over the related records named by that field — the control the form draws —
 * rather than a text box holding the linked key. Nothing for any other column,
 * nor for a multi-valued link, which keeps its plain control.
 */
const relationshipOverlay = (
  column: Readonly<Record<string, unknown>> | undefined
): Pick<DerivedRecordField, 'relatedTable' | 'displayField' | 'required'> => {
  if (column?.['type'] !== 'relationship' || column['allowMultiple'] === true) return {}
  const { relatedTable, displayField } = column
  if (typeof relatedTable !== 'string') return {}
  return {
    relatedTable,
    ...(typeof displayField === 'string' ? { displayField } : {}),
    ...(column['required'] === true ? { required: true } : {}),
  }
}

/**
 * The `required` overlay of one entry: a column that must hold a value, so the
 * editable drawer refuses to save it blank — and only such a column.
 */
const requiredOverlay = (
  column: Readonly<Record<string, unknown>> | undefined
): Pick<DerivedRecordField, 'required'> => (column?.['required'] === true ? { required: true } : {})

/** The `weekday` and `timeZone` overlay of one entry: the bound date column's, when it declares them. */
const weekdayOverlay = (
  column: Readonly<Record<string, unknown>> | undefined
): Pick<DerivedRecordField, 'weekday' | 'timeZone'> => {
  const weekday = column?.['weekday']
  const timeZone = column?.['type'] === 'datetime' ? column['timeZone'] : undefined
  return {
    ...(weekday === 'short' || weekday === 'long' ? { weekday } : {}),
    ...(typeof timeZone === 'string' && timeZone !== '' ? { timeZone } : {}),
  }
}

/**
 * The page language an entry's option labels resolve against, and the app's
 * `design.badgeForm` its option badges are painted in.
 */
export interface DrawerFieldLocale {
  readonly languages?: Languages | undefined
  readonly currentLang?: string | undefined
  readonly badgeForm?: BadgeForm | undefined
}

/** The `paints` overlay of one entry: its option colours, painted as the grid's pill. */
const paintsOverlay = (
  table: Tables[number] | undefined,
  fieldName: unknown,
  locale: DrawerFieldLocale
): Pick<DerivedRecordField, 'paints'> => {
  if (table === undefined || typeof fieldName !== 'string') return {}
  const paints = resolveOptionBadgePaints(table, fieldName, locale.badgeForm, 'grid')
  return paints === undefined || Object.keys(paints).length === 0 ? {} : { paints }
}

/** Attachment column types, whose editable control is a file picker. */
const ATTACHMENT_TYPES: ReadonlySet<unknown> = new Set([
  'single-attachment',
  'multiple-attachments',
])

/**
 * The `bucket` / constraints overlay of one entry: what an attachment column
 * declares, so the editable drawer's file picker uploads where the form's does
 * and refuses what the form refuses. Nothing for any other column.
 */
const attachmentOverlay = (
  column: Readonly<Record<string, unknown>> | undefined
): Pick<DerivedRecordField, 'bucket' | 'allowedFileTypes' | 'maxFileSize'> => {
  if (!ATTACHMENT_TYPES.has(column?.['type'])) return {}
  const { bucket, allowedFileTypes, maxFileSize } = column ?? {}
  return {
    ...(typeof bucket === 'string' && bucket !== '' ? { bucket } : {}),
    ...(Array.isArray(allowedFileTypes)
      ? { allowedFileTypes: allowedFileTypes as readonly string[] }
      : {}),
    ...(typeof maxFileSize === 'number' ? { maxFileSize } : {}),
  }
}

/**
 * The `options` overlay of one entry: a `single-select` or `status` column's
 * declared options, labels in the page language, so an editable drawer offers
 * the same choice the form does. Nothing for any other column.
 */
const optionsOverlay = (
  column: Readonly<{ readonly type?: string; readonly options?: unknown }> | undefined,
  locale: DrawerFieldLocale
): Pick<DerivedRecordField, 'options'> => {
  if (column?.type !== 'single-select' && column?.type !== 'status') return {}
  const options = readColumnOptions(column, locale.languages, locale.currentLang)
  return options === undefined ? {} : { options }
}

/** The `currency` overlay of one entry: the bound column's declared display, or nothing. */
const currencyOverlay = (
  table: Tables[number] | undefined,
  fieldName: unknown,
  tables: Tables | undefined
): { readonly currency?: CurrencyDisplayOptions } => {
  if (table === undefined || typeof fieldName !== 'string') return {}
  const currency = resolveValueCurrency(table, fieldName, tables ?? [])
  return currency === undefined ? {} : { currency }
}

/**
 * Resolve one drawer entry's display name + guidance against the bound table.
 *
 * The entry's own `label` / `description` win; otherwise the bound field's are
 * used; otherwise nothing is emitted and the island keeps its raw-`name`
 * fallback. `boundField` is `undefined` for a system-bound drawer — a system
 * DETAIL endpoint has no field schema behind it, so the per-entry override is
 * the only naming such an entry can have.
 */
function withResolvedFieldDisplay(
  entry: Readonly<Record<string, unknown>>,
  boundField: Readonly<Record<string, unknown>> | undefined
): Record<string, unknown> {
  const label = declaredFieldLabel(entry) ?? declaredFieldLabel(boundField)
  const description = declaredFieldDescription(entry) ?? declaredFieldDescription(boundField)
  return {
    ...entry,
    ...(label === undefined ? {} : { label }),
    ...(description === undefined ? {} : { description }),
  }
}

/**
 * Enrich the drawer entries an author DECLARED with the bound table's field
 * schema, so an entry carrying no `label` / `description` of its own still
 * resolves the bound field's.
 *
 * Declared entries used to pass through verbatim, which meant a field-level
 * `label` reached the auto-DERIVED case only — the opposite of the documented
 * resolution order, under which the per-entry value is an OVERRIDE of the
 * field's rather than the only rung that works.
 */
function enrichDeclaredFields(
  declared: readonly unknown[],
  component: Component | undefined,
  tables: Tables | undefined,
  locale: DrawerFieldLocale
): readonly unknown[] {
  const table = component ? resolveSourceTable(component, tables) : undefined
  const tableFields = table?.fields
  return declared.map((entry) => {
    if (typeof entry !== 'object' || entry === null) return entry
    const record = entry as Readonly<Record<string, unknown>>
    const boundField = tableFields?.find((field) => field.name === record['name']) as
      Readonly<Record<string, unknown>> | undefined
    return {
      ...withResolvedFieldDisplay(record, boundField),
      ...currencyOverlay(table, record['name'], tables),
      ...optionsOverlay(boundField, locale),
      ...paintsOverlay(table, record['name'], locale),
      ...weekdayOverlay(boundField),
      ...relationshipOverlay(boundField),
      ...requiredOverlay(boundField),
      ...attachmentOverlay(boundField),
    }
  })
}

/**
 * The record-drawer's SCHEMA-DERIVED field list.
 *
 * `recordFields` is optional, and the component's contract is that "one
 * component serves EVERY table because the form is DERIVED from the field
 * schema at render time". An author who omits it must therefore get one control
 * per declared field of the bound table — not an empty shell.
 *
 * Shares {@link resolveSourceTable} with the data-table's own derivation
 * (`resolveDataTableInputs`) so the `dataSource → app.tables` lookup lives in
 * one place. The two differ only in projection: a grid needs field NAMES, a
 * drawer needs `{ name, type }` plus its resolved display strings (its controls
 * are typed from the field schema).
 *
 * Returns `undefined` when the component has no table binding (a `system`
 * detail source, or a table the config does not declare) — the caller then
 * leaves `recordFields` absent, exactly as before.
 */
export function resolveRecordDrawerFields(
  component: Component | undefined,
  tables: Tables | undefined,
  locale: DrawerFieldLocale = {}
): ReadonlyArray<DerivedRecordField> | undefined {
  if (!component) return undefined
  const table = resolveSourceTable(component, tables)
  if (!table) return undefined
  return table.fields.map((field) => {
    const declared = field as Readonly<Record<string, unknown>>
    const label = declaredFieldLabel(declared)
    const description = declaredFieldDescription(declared)
    return {
      name: field.name,
      type: field.type,
      ...(label === undefined ? {} : { label }),
      ...(description === undefined ? {} : { description }),
      ...currencyOverlay(table, field.name, tables),
      ...optionsOverlay(declared, locale),
      ...paintsOverlay(table, field.name, locale),
      ...weekdayOverlay(declared),
      ...relationshipOverlay(declared),
      ...requiredOverlay(declared),
      ...attachmentOverlay(declared),
    }
  })
}

/**
 * The `recordFields` prop the SSR host hands the drawer island.
 *
 * ONE entry point for both cases, because both resolve the same display
 * strings: an omitted list is DERIVED from the bound table, and a DECLARED list
 * is enriched from it. Splitting them at the call site is how the declared case
 * ended up skipping the field-level `label` entirely.
 */
export function resolveRecordDrawerFieldProp(
  declared: unknown,
  component: Component | undefined,
  tables: Tables | undefined,
  locale: DrawerFieldLocale = {}
): unknown {
  if (declared === undefined) return resolveRecordDrawerFields(component, tables, locale)
  if (!Array.isArray(declared)) return declared
  return enrichDeclaredFields(declared, component, tables, locale)
}
