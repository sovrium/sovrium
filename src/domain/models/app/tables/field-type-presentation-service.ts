/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { RecordTextField } from './record-text-service'

/**
 * How a field TYPE reads by default, wherever a value is shown without a format
 * of its own: one table for the server's page text (`record-value-format.ts`,
 * which also feeds the list, gallery and board cards) and for the data grid's
 * cell renderers, so the two cannot drift again. They had: the grid printed a
 * `created-at` as the raw ISO instant and a percentage as `${n}%` while the page
 * text formatted both.
 *
 * Only these types are formatted. A `number`, `integer`, `decimal` or
 * `autonumber` stays as stored: a year, a reference or a quantity printed with
 * grouping (`2,026`) is wrong. What those types DO get by default is their
 * place: right-aligned, in tabular figures ({@link defaultAlignOfFieldType}).
 */
const TEXT_FORMAT_BY_FIELD_TYPE: Readonly<Record<string, RecordTextField['format']>> = {
  currency: 'currency',
  date: 'short-date',
  datetime: 'datetime',
  'created-at': 'datetime',
  'updated-at': 'datetime',
  'deleted-at': 'datetime',
  percentage: 'percent',
  checkbox: 'yes-no',
  'single-select': 'option',
  status: 'option',
  'multi-select': 'options',
  duration: 'duration-clock',
}

/** The format a field type reads in by default, or `undefined` when it prints as stored. */
export const defaultTextFormatOfFieldType = (
  fieldType: string | undefined
): RecordTextField['format'] | undefined =>
  fieldType === undefined ? undefined : TEXT_FORMAT_BY_FIELD_TYPE[fieldType]

/**
 * The field types whose values are QUANTITIES: a reader compares them down a
 * column, so they sit on the right edge (the units digit under the units digit,
 * as a ledger sets them) and in tabular figures. A `rating` or `progress` is a
 * quantity drawn as a graphic and keeps the leading edge; a `duration` reads
 * as a quantity (`1h 30m`) and aligns with the numbers.
 */
const QUANTITY_FIELD_TYPES: ReadonlySet<string> = new Set([
  'number',
  'integer',
  'decimal',
  'currency',
  'percentage',
  'autonumber',
  'count',
  'duration',
])

/**
 * The field types a reader scans DOWN a column — every quantity, and every
 * instant or time of day. Proportional digits defeat that (`1,111` is narrower
 * than `9,999`), so their values are set in tabular figures.
 */
const TABULAR_FIELD_TYPES: ReadonlySet<string> = new Set([
  ...QUANTITY_FIELD_TYPES,
  'date',
  'datetime',
  'time',
  'created-at',
  'updated-at',
  'deleted-at',
])

/** A column's default alignment for its field type: `right` for a quantity, else none. */
export const defaultAlignOfFieldType = (fieldType: string | undefined): 'right' | undefined =>
  fieldType !== undefined && QUANTITY_FIELD_TYPES.has(fieldType) ? 'right' : undefined

/** Whether a field type's values are set in tabular figures. */
export const readsInTabularFigures = (fieldType: string | undefined): boolean =>
  fieldType !== undefined && TABULAR_FIELD_TYPES.has(fieldType)
