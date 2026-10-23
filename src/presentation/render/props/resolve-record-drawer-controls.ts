/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a record sheet's typed control needs from its column, beyond a name and
 * a type: the scale of a rating, the options of a multi-select, the language of
 * a code value, the related table of a multi-valued link, the format a duration
 * reads in, and the value a new record starts with.
 *
 * And one decision: whether the field is read at all rather than written. A
 * computed field (formula, rollup, lookup, count, autonumber), an AI field and
 * a field the engine stamps (created/updated/deleted at and by) are drawn as
 * their value — nobody types into them, and Save never sends them.
 */

import {
  FIELD_TYPE_CATEGORIES,
  isReadOnlyFieldType,
} from '@/domain/models/app/tables/fields/field-types/catalog'
import { readColumnOptions } from '@/presentation/render/forms/form-field-resolver'
import type { DrawerFieldLocale } from './resolve-record-drawer-fields'

type Column = Readonly<Record<string, unknown>> | undefined

/** The category the domain files a field type under, or `''` for an unknown type. */
const categoryOf = (type: string): string =>
  FIELD_TYPE_CATEGORIES.find((entry) => entry.types.includes(type))?.category ?? ''

/** Whether a field of this type is read, never written, in a record sheet. */
export const isReadOnlyEntryType = (type: string): boolean =>
  isReadOnlyFieldType(type, categoryOf(type))

/** The overlay a typed control reads; every member is absent when it does not apply. */
export interface DrawerControlOverlay {
  readonly max?: number
  readonly ratingStyle?: string
  readonly options?: ReadonlyArray<{ readonly value: string; readonly label: string }>
  readonly language?: string
  readonly relatedTable?: string
  readonly displayField?: string
  readonly allowMultiple?: true
  readonly displayFormat?: string
  readonly defaultValue?: string
}

/** A rating's scale and its glyph. */
const ratingOverlay = (column: Column): DrawerControlOverlay => {
  if (column?.['type'] !== 'rating') return {}
  const { max, style } = column
  return {
    ...(typeof max === 'number' ? { max } : {}),
    ...(typeof style === 'string' ? { ratingStyle: style } : {}),
  }
}

/** A multi-select's options, labelled in the page language. */
const multiSelectOverlay = (column: Column, locale: DrawerFieldLocale): DrawerControlOverlay => {
  if (column?.['type'] !== 'multi-select') return {}
  const options = readColumnOptions(column, locale.languages, locale.currentLang)
  return options === undefined ? {} : { options }
}

/** A multi-valued link: its related table and the field its records are named by. */
const multiLinkOverlay = (column: Column): DrawerControlOverlay => {
  if (column?.['type'] !== 'relationship' || column['allowMultiple'] !== true) return {}
  const { relatedTable, displayField } = column
  if (typeof relatedTable !== 'string') return {}
  return {
    relatedTable,
    allowMultiple: true,
    ...(typeof displayField === 'string' ? { displayField } : {}),
  }
}

/** A code value's language, and a duration's display format. */
const formatOverlay = (column: Column): DrawerControlOverlay => {
  const { type, language, displayFormat } = column ?? {}
  return {
    ...(type === 'code' && typeof language === 'string' ? { language } : {}),
    ...(type === 'duration' && typeof displayFormat === 'string' ? { displayFormat } : {}),
  }
}

/**
 * The value a new record starts with: the column's declared `default`, as text.
 * A default the server resolves — `$currentUser`, `$now` — is no value a
 * control can hold: the control starts empty, the untouched field is left out
 * of the create, and the server fills it as it does for any create.
 */
const defaultOverlay = (column: Column): DrawerControlOverlay => {
  const declared = column?.['default']
  if (typeof declared === 'string' && declared.startsWith('$')) return {}
  if (typeof declared === 'string' || typeof declared === 'number') {
    return { defaultValue: String(declared) }
  }
  return typeof declared === 'boolean' ? { defaultValue: String(declared) } : {}
}

/** Everything a typed control reads from its column. */
export const controlOverlay = (
  column: Column,
  locale: DrawerFieldLocale
): DrawerControlOverlay => ({
  ...ratingOverlay(column),
  ...multiSelectOverlay(column, locale),
  ...multiLinkOverlay(column),
  ...formatOverlay(column),
  ...defaultOverlay(column),
})

/**
 * `readOnly: true` for a computed, AI or stamped field, and for the one-to-many
 * side of a link — the records pointing here, which are written on THEIR side
 * — and nothing for any other.
 */
export const readOnlyTypeOverlay = (column: Column): { readonly readOnly?: true } => {
  const type = String(column?.['type'] ?? '')
  const reverseLink = type === 'relationship' && column?.['relationType'] === 'one-to-many'
  return isReadOnlyEntryType(type) || reverseLink ? { readOnly: true } : {}
}
