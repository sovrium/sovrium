/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { FieldType } from '@/domain/models/app/tables/fields'

export type FieldWidget =
  | 'text'
  | 'email'
  | 'url'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'code'
  | 'rich-text'
  | 'file-single'
  | 'file-multiple'
  | 'button'

export interface FieldTypeBehavior {
  readonly widget: FieldWidget
  readonly omitWhenEmpty: boolean
}

const TEXT_SENDS_EMPTY: FieldTypeBehavior = { widget: 'text', omitWhenEmpty: false }
const TEXT_OMITS_EMPTY: FieldTypeBehavior = { widget: 'text', omitWhenEmpty: true }
const SELECT_OMITS_EMPTY: FieldTypeBehavior = { widget: 'select', omitWhenEmpty: true }

const FIELD_TYPE_BEHAVIOR = {
  'single-line-text': TEXT_SENDS_EMPTY,
  'long-text': { widget: 'textarea', omitWhenEmpty: false },
  'rich-text': { widget: 'rich-text', omitWhenEmpty: false },
  code: { widget: 'code', omitWhenEmpty: false },
  email: { widget: 'email', omitWhenEmpty: false },
  url: { widget: 'url', omitWhenEmpty: true },
  'phone-number': TEXT_SENDS_EMPTY,
  barcode: TEXT_SENDS_EMPTY,

  integer: TEXT_OMITS_EMPTY,
  decimal: TEXT_OMITS_EMPTY,
  currency: TEXT_OMITS_EMPTY,
  percentage: TEXT_OMITS_EMPTY,
  rating: TEXT_OMITS_EMPTY,
  duration: TEXT_OMITS_EMPTY,
  progress: TEXT_OMITS_EMPTY,

  date: TEXT_OMITS_EMPTY,
  datetime: TEXT_OMITS_EMPTY,
  time: TEXT_OMITS_EMPTY,

  'single-select': SELECT_OMITS_EMPTY,
  status: SELECT_OMITS_EMPTY,
  'multi-select': TEXT_OMITS_EMPTY,

  checkbox: { widget: 'checkbox', omitWhenEmpty: true },
  color: TEXT_OMITS_EMPTY,
  geolocation: TEXT_OMITS_EMPTY,
  array: TEXT_OMITS_EMPTY,
  json: TEXT_SENDS_EMPTY,

  relationship: TEXT_OMITS_EMPTY,
  user: TEXT_OMITS_EMPTY,

  'single-attachment': { widget: 'file-single', omitWhenEmpty: true },
  'multiple-attachments': { widget: 'file-multiple', omitWhenEmpty: true },

  formula: TEXT_OMITS_EMPTY,
  rollup: TEXT_OMITS_EMPTY,
  lookup: TEXT_OMITS_EMPTY,
  count: TEXT_OMITS_EMPTY,
  autonumber: TEXT_OMITS_EMPTY,
  button: { widget: 'button', omitWhenEmpty: true },
  'created-at': TEXT_OMITS_EMPTY,
  'created-by': TEXT_OMITS_EMPTY,
  'updated-at': TEXT_OMITS_EMPTY,
  'updated-by': TEXT_OMITS_EMPTY,
  'deleted-at': TEXT_OMITS_EMPTY,
  'deleted-by': TEXT_OMITS_EMPTY,

  'ai-categorize': TEXT_SENDS_EMPTY,
  'ai-extract': TEXT_SENDS_EMPTY,
  'ai-generate': TEXT_SENDS_EMPTY,
  'ai-sentiment': TEXT_SENDS_EMPTY,
  'ai-summary': TEXT_SENDS_EMPTY,
  'ai-tag': TEXT_SENDS_EMPTY,
  'ai-translate': TEXT_SENDS_EMPTY,
} as const satisfies Record<FieldType, FieldTypeBehavior>

const UNKNOWN_FIELD_BEHAVIOR: FieldTypeBehavior = { widget: 'text', omitWhenEmpty: false }

export function fieldTypeBehavior(type: string): FieldTypeBehavior {
  const table: Readonly<Record<string, FieldTypeBehavior | undefined>> = FIELD_TYPE_BEHAVIOR
  return table[type] ?? UNKNOWN_FIELD_BEHAVIOR
}

export function fieldWidgetOf(type: string): FieldWidget {
  return fieldTypeBehavior(type).widget
}

const WIDGET_SHOWS_DECLARED_DEFAULT: Record<FieldWidget, boolean> = {
  select: true,
  text: false,
  email: false,
  url: false,
  textarea: false,
  checkbox: false,
  code: false,
  'rich-text': false,
  'file-single': false,
  'file-multiple': false,
  button: false,
}

export function showsDeclaredDefault(type: string): boolean {
  return WIDGET_SHOWS_DECLARED_DEFAULT[fieldWidgetOf(type)]
}

export function omitsEmptyValue(type: string): boolean {
  return fieldTypeBehavior(type).omitWhenEmpty
}
