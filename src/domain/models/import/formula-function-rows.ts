/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The vocabulary of the formula function tables: the row shapes, the
 * constructors the tables are written with, and the reasons several rows
 * share. The tables themselves are in `formula-function-mappings.ts`.
 */

/** The static type of a formula value, as far as the emitter can tell. */
export type FormulaValueType =
  'number' | 'text' | 'boolean' | 'date' | 'datetime' | 'null' | 'unknown'

/** The emitters that need more than a rename. */
export type SpecialEmitter =
  | 'if'
  | 'ifs'
  | 'switch'
  | 'and'
  | 'or'
  | 'not'
  | 'concat'
  | 'blank'
  | 'true'
  | 'false'
  | 'left'
  | 'right'
  | 'mid'
  | 'replaceAt'
  | 'substring'
  | 'contains'
  | 'empty'
  | 'today'
  | 'now'
  | 'createdTime'
  | 'lastModifiedTime'
  | 'ceilingTo'
  | 'floorTo'
  | 'round'
  | 'roundUp'
  | 'roundDown'
  | 'log'
  | 'log2'
  | 'sum'
  | 'isAfter'
  | 'isBefore'
  | 'isSame'
  | 'equal'
  | 'unequal'
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'modulo'
  | 'power'
  | 'toText'
  | 'toDate'
  | 'pi'
  | 'e'
  | 'sqrt'
  | 'ln'
  | 'log10'
  | 'year'
  | 'month'
  | 'day'
  | 'hour'
  | 'minute'
  | 'second'
  | 'datetimeFormat'
  | 'datetimeParse'
  | 'daysBetween'
  | 'dateAdd'
  | 'weekday'
  | 'find'
  | 'recordId'
  | 'value'

/** How a mapped function is emitted. */
export type FunctionEmit =
  | {
      readonly kind: 'rename'
      /** The whitelisted function it becomes. */
      readonly name: string
      /** What it returns; `first` is the type of its first argument. */
      readonly returns: FormulaValueType | 'first'
      /** What every argument must be. */
      readonly accepts: FormulaValueType
    }
  | { readonly kind: 'special'; readonly name: SpecialEmitter }

/** One row of a function table. */
export type FunctionMapping =
  | {
      readonly source: string
      readonly outcome: 'mapped'
      readonly emit: FunctionEmit
      /** The fewest and most arguments the source function takes. */
      readonly arity: readonly [number, number]
      /** What differs at the edges, when something does. */
      readonly note?: string
      /**
       * The arguments it maps for, when not every call does: a call outside
       * them keeps its values, with the emitter's reason.
       */
      readonly when?: string
    }
  | {
      readonly source: string
      readonly outcome: 'degraded' | 'unsupported'
      readonly reason: string
    }

export const MANY = Number.POSITIVE_INFINITY

export const special = (
  source: string,
  name: SpecialEmitter,
  arity: readonly [number, number],
  note?: string
): FunctionMapping => ({
  source,
  outcome: 'mapped',
  emit: { kind: 'special', name },
  arity,
  ...(note === undefined ? {} : { note }),
})

/** A special row that maps only the calls `when` describes; the others are refused as degraded. */
export const conditional = (
  source: string,
  name: SpecialEmitter,
  arity: readonly [number, number],
  when: string
): FunctionMapping => ({
  source,
  outcome: 'mapped',
  emit: { kind: 'special', name },
  arity,
  when,
})

export const rename = (
  source: string,
  name: string,
  types: { readonly accepts: FormulaValueType; readonly returns: FormulaValueType | 'first' },
  arity: readonly [number, number]
): FunctionMapping => ({
  source,
  outcome: 'mapped',
  emit: { kind: 'rename', name, ...types },
  arity,
})

export const degraded = (source: string, reason: string): FunctionMapping => ({
  source,
  outcome: 'degraded',
  reason,
})

export const unsupported = (source: string, reason: string): FunctionMapping => ({
  source,
  outcome: 'unsupported',
  reason,
})

export const TEXT_TO_TEXT = { accepts: 'text', returns: 'text' } as const
export const NUMBER_TO_NUMBER = { accepts: 'number', returns: 'number' } as const

export const POSTGRES_ONLY_REGEX =
  'Regular expressions run on PostgreSQL only, and with a different syntax (POSIX, not RE2)'
export const BLANK_AWARE_MIN_MAX =
  'PostgreSQL skips a blank operand and SQLite returns blank, so the two engines would disagree'
export const LISTS = 'Formulas over lists of values have no counterpart in a Sovrium formula'
export const PEOPLE = 'Sovrium formulas cannot read the people a field names'

/** Why a Notion date function that does date arithmetic is not translated yet. */
export const NO_DAY_ARITHMETIC =
  "Notion's date arithmetic is not yet checked against Sovrium's portable date functions"
/** Why Notion's day of the week is not translated yet. */
export const NO_WEEKDAY =
  "Notion's numbering of the days of the week is not yet checked against Sovrium's portable date functions"
/** Why Notion's week number is not translated yet. */
export const NO_WEEK_NUMBER =
  "Notion's numbering of weeks is not yet checked against the ISO 8601 week Sovrium reads"
/** Why Airtable's WEEKNUM is not translated. */
export const AIRTABLE_WEEK_NUMBER =
  'Airtable counts weeks from the week holding 1 January, where Sovrium reads the ISO 8601 week'
/** Why a function over the current time is not translated beyond TODAY() and NOW(). */
export const NO_CLOCK_ARITHMETIC =
  "A duration from now counts elapsed time, which Sovrium's portable date functions do not"
/** Why SEARCH is not translated. */
export const NO_PORTABLE_POSITION =
  'SEARCH() returns blank where the text is absent; only FIND() with two arguments is translated'
/** When DATETIME_DIFF and DATEADD translate. */
export const WHEN_DAY_UNITS = 'Its dates are date fields and its unit is days or weeks, written out'
/** When WEEKDAY translates. */
export const WHEN_WEEKDAY =
  "Its argument is a date or date-and-time field, read in UTC, and its start day, if any, is 'Sunday' or 'Monday'"
/** When FIND translates. */
export const WHEN_NO_START = 'It is called with two arguments, without a start position'
/** Why a Notion date part of a date and time is not translated. */
export const NOTION_TIME_ZONE =
  "Notion reads a date and time in the viewer's time zone, which the import cannot know"

/** When a date part translates: the field it reads, in UTC. */
export const WHEN_DATE_FIELD = 'Its argument is a date or a date-and-time field, read in UTC'
/** When a time part translates. */
export const WHEN_DATETIME_FIELD = 'Its argument is a date-and-time field, read in UTC'
/** When a Notion date part translates. */
export const WHEN_NOTION_DATE_FIELD = 'Its argument is a date field without a time'
/** When a value conversion translates. */
export const WHEN_NUMBER_OR_LITERAL =
  'Its argument is a number, or text that is written as a number'
/** When DATETIME_FORMAT translates. */
export const WHEN_LITERAL_FORMAT =
  'Its date is a date or date-and-time field and its format is written out with YYYY, YY, MMMM, MMM, MM, M, DD, D, HH, H, mm and ss only'
/** When DATETIME_PARSE translates. */
export const WHEN_LITERAL_DAY =
  'Its text and format are written out and name one day with YYYY, MM, M, DD and D only'

/** The note a translated `RECORD_ID()` carries. */
export const RECORD_ID_NOTE =
  'Reads the Airtable record id kept in source_id; records created after the import have none, so it is blank for them'
