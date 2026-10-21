/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The formula function tables: one per dialect, source function → Sovrium.
 *
 * ## The table is the whole rule
 *
 * A source function is translated only through its dialect's row here, and
 * every row says one of three things:
 *
 * - `mapped`: it becomes Sovrium formula text that means the same on SQLite
 *   and PostgreSQL. A row with a `note` translates, and the note is printed
 *   beside the field so the reader knows what differs at the edges.
 * - `degraded`: Sovrium has something close, but only on PostgreSQL, or not
 *   with the same meaning. It is NOT emitted: a formula that boots on one
 *   engine and refuses the other is worse than a column of values.
 * - `unsupported`: nothing in the formula whitelist does it.
 *
 * A function the table does not list is `unsupported`. Either refusal turns
 * the whole field into a column of its last computed values, with a TODO
 * quoting the original formula.
 *
 * ## Emitters
 *
 * A `rename` row is the same call under a whitelisted name. A `special` row
 * names an emitter in `formula-emitter-service.ts` that needs more than a
 * rename: `IF` is a `CASE`, `LEFT` is a `SUBSTR` from 1, Notion's 0-based
 * `substring` shifts its bounds. The emitter registry and this union are typed
 * against each other, so a row naming an emitter that does not exist does not
 * compile.
 */

import {
  AIRTABLE_WEEK_NUMBER,
  BLANK_AWARE_MIN_MAX,
  LISTS,
  MANY,
  NO_CLOCK_ARITHMETIC,
  NO_DAY_ARITHMETIC,
  NO_PORTABLE_POSITION,
  NO_WEEKDAY,
  NO_WEEK_NUMBER,
  NOTION_TIME_ZONE,
  NUMBER_TO_NUMBER,
  PEOPLE,
  POSTGRES_ONLY_REGEX,
  RECORD_ID_NOTE,
  TEXT_TO_TEXT,
  WHEN_DATETIME_FIELD,
  WHEN_DATE_FIELD,
  WHEN_DAY_UNITS,
  WHEN_LITERAL_DAY,
  WHEN_LITERAL_FORMAT,
  WHEN_NOTION_DATE_FIELD,
  WHEN_NO_START,
  WHEN_NUMBER_OR_LITERAL,
  WHEN_WEEKDAY,
  conditional,
  degraded,
  rename,
  special,
  unsupported,
  type FunctionMapping,
} from './formula-function-rows'
import type { FormulaDialect } from './formula-ast'

export type {
  FormulaValueType,
  FunctionEmit,
  FunctionMapping,
  SpecialEmitter,
} from './formula-function-rows'

/** Airtable's formula functions, as its formula field reference lists them. */
const AIRTABLE: readonly FunctionMapping[] = [
  // logical
  special('IF', 'if', [2, 3]),
  special('SWITCH', 'switch', [3, MANY]),
  special('AND', 'and', [1, MANY]),
  special('OR', 'or', [1, MANY]),
  special('NOT', 'not', [1, 1]),
  special('BLANK', 'blank', [0, 0]),
  special('TRUE', 'true', [0, 0]),
  special('FALSE', 'false', [0, 0]),
  unsupported('XOR', 'Sovrium formulas have no exclusive-or'),
  unsupported('ERROR', 'Sovrium formulas cannot raise an error value'),
  unsupported('ISERROR', 'Sovrium formulas have no error values to test'),
  // text
  special('CONCATENATE', 'concat', [1, MANY]),
  rename('LOWER', 'LOWER', TEXT_TO_TEXT, [1, 1]),
  rename('UPPER', 'UPPER', TEXT_TO_TEXT, [1, 1]),
  rename('TRIM', 'TRIM', TEXT_TO_TEXT, [1, 1]),
  rename('LEN', 'LENGTH', { accepts: 'text', returns: 'number' }, [1, 1]),
  special('LEFT', 'left', [2, 2]),
  special('RIGHT', 'right', [2, 2]),
  special('MID', 'mid', [3, 3]),
  rename('SUBSTITUTE', 'REPLACE', TEXT_TO_TEXT, [3, 3]),
  special('REPLACE', 'replaceAt', [4, 4]),
  conditional('FIND', 'find', [2, 3], WHEN_NO_START),
  degraded('SEARCH', NO_PORTABLE_POSITION),
  degraded('REPT', 'Repeating text needs REPEAT, which SQLite does not provide'),
  degraded('REGEX_MATCH', POSTGRES_ONLY_REGEX),
  degraded('REGEX_EXTRACT', POSTGRES_ONLY_REGEX),
  degraded('REGEX_REPLACE', POSTGRES_ONLY_REGEX),
  unsupported('T', 'Sovrium formulas cannot test whether a value is text'),
  unsupported('ENCODE_URL_COMPONENT', 'Sovrium formulas have no URL encoding'),
  // numeric
  rename('ABS', 'ABS', NUMBER_TO_NUMBER, [1, 1]),
  special('CEILING', 'ceilingTo', [1, 2]),
  special('FLOOR', 'floorTo', [1, 2]),
  rename('INT', 'FLOOR', NUMBER_TO_NUMBER, [1, 1]),
  rename('EXP', 'EXP', NUMBER_TO_NUMBER, [1, 1]),
  special('LOG', 'log', [1, 2]),
  special('MOD', 'modulo', [2, 2]),
  special('POWER', 'power', [2, 2]),
  special('SQRT', 'sqrt', [1, 1]),
  special('ROUND', 'round', [1, 2]),
  special('ROUNDUP', 'roundUp', [2, 2]),
  special('ROUNDDOWN', 'roundDown', [2, 2]),
  special('SUM', 'sum', [1, MANY]),
  degraded('MAX', BLANK_AWARE_MIN_MAX),
  degraded('MIN', BLANK_AWARE_MIN_MAX),
  degraded(
    'AVERAGE',
    'Averaging skips blank operands in Airtable; a formula cannot tell how many were blank'
  ),
  conditional('VALUE', 'value', [1, 1], WHEN_NUMBER_OR_LITERAL),
  unsupported('COUNT', 'Counting the numeric arguments of a call has no counterpart'),
  unsupported('COUNTA', 'Counting the non-empty arguments of a call has no counterpart'),
  unsupported('COUNTALL', 'Counting the arguments of a call has no counterpart'),
  unsupported('EVEN', 'Sovrium formulas have no rounding to an even integer'),
  unsupported('ODD', 'Sovrium formulas have no rounding to an odd integer'),
  // date and time
  special('TODAY', 'today', [0, 0]),
  special('NOW', 'now', [0, 0]),
  special('CREATED_TIME', 'createdTime', [0, 0]),
  special('LAST_MODIFIED_TIME', 'lastModifiedTime', [0, 0]),
  special('IS_AFTER', 'isAfter', [2, 2]),
  special('IS_BEFORE', 'isBefore', [2, 2]),
  special('IS_SAME', 'isSame', [2, 2]),
  special('DATESTR', 'toDate', [1, 1]),
  conditional('YEAR', 'year', [1, 1], WHEN_DATE_FIELD),
  conditional('MONTH', 'month', [1, 1], WHEN_DATE_FIELD),
  conditional('DAY', 'day', [1, 1], WHEN_DATE_FIELD),
  conditional('HOUR', 'hour', [1, 1], WHEN_DATETIME_FIELD),
  conditional('MINUTE', 'minute', [1, 1], WHEN_DATETIME_FIELD),
  conditional('SECOND', 'second', [1, 1], WHEN_DATETIME_FIELD),
  conditional('DATETIME_FORMAT', 'datetimeFormat', [1, 2], WHEN_LITERAL_FORMAT),
  conditional('DATETIME_PARSE', 'datetimeParse', [1, 3], WHEN_LITERAL_DAY),
  conditional('WEEKDAY', 'weekday', [1, 2], WHEN_WEEKDAY),
  degraded('WEEKNUM', AIRTABLE_WEEK_NUMBER),
  conditional('DATEADD', 'dateAdd', [3, 3], WHEN_DAY_UNITS),
  conditional('DATETIME_DIFF', 'daysBetween', [2, 3], WHEN_DAY_UNITS),
  degraded(
    'TIMESTR',
    'Airtable prints the milliseconds, which SQLite and PostgreSQL write differently'
  ),
  degraded('TONOW', NO_CLOCK_ARITHMETIC),
  degraded('FROMNOW', NO_CLOCK_ARITHMETIC),
  unsupported('WORKDAY', 'Sovrium formulas have no working-day calendar'),
  unsupported('WORKDAY_DIFF', 'Sovrium formulas have no working-day calendar'),
  unsupported('SET_LOCALE', 'Sovrium formulas have no locale-aware date formatting'),
  unsupported('SET_TIMEZONE', 'Sovrium formulas have no time-zone conversion'),
  // lists and records
  unsupported('ARRAYJOIN', LISTS),
  unsupported('ARRAYUNIQUE', LISTS),
  unsupported('ARRAYCOMPACT', LISTS),
  unsupported('ARRAYFLATTEN', LISTS),
  unsupported('ARRAYSLICE', LISTS),
  special('RECORD_ID', 'recordId', [0, 0], RECORD_ID_NOTE),
]

/** Notion's formula functions (formula language 2.0), as its formula reference lists them. */
const NOTION: readonly FunctionMapping[] = [
  // logical
  special('IF', 'if', [3, 3]),
  special('IFS', 'ifs', [3, MANY]),
  special('AND', 'and', [2, MANY]),
  special('OR', 'or', [2, MANY]),
  special('NOT', 'not', [1, 1]),
  special('EMPTY', 'empty', [1, 1]),
  special('EQUAL', 'equal', [2, 2]),
  special('UNEQUAL', 'unequal', [2, 2]),
  // text
  special('CONCAT', 'concat', [1, MANY]),
  rename('LOWER', 'LOWER', TEXT_TO_TEXT, [1, 1]),
  rename('UPPER', 'UPPER', TEXT_TO_TEXT, [1, 1]),
  rename('TRIM', 'TRIM', TEXT_TO_TEXT, [1, 1]),
  rename('LENGTH', 'LENGTH', { accepts: 'text', returns: 'number' }, [1, 1]),
  special('SUBSTRING', 'substring', [2, 3]),
  special('CONTAINS', 'contains', [2, 2]),
  special(
    'FORMAT',
    'toText',
    [1, 1],
    'A number is written the way the database prints it, which can keep trailing zeros'
  ),
  degraded('TEST', POSTGRES_ONLY_REGEX),
  degraded('MATCH', POSTGRES_ONLY_REGEX),
  degraded('REPLACE', POSTGRES_ONLY_REGEX),
  degraded('REPLACEALL', POSTGRES_ONLY_REGEX),
  degraded('REPEAT', 'Repeating text needs REPEAT, which SQLite does not provide'),
  conditional('TONUMBER', 'value', [1, 1], WHEN_NUMBER_OR_LITERAL),
  unsupported('PADSTART', 'Sovrium formulas have no padding function'),
  unsupported('PADEND', 'Sovrium formulas have no padding function'),
  unsupported('LINK', 'Sovrium formulas return plain values, not links'),
  unsupported('STYLE', 'Sovrium formulas return plain values, not styled text'),
  unsupported('UNSTYLE', 'Sovrium formulas return plain values, not styled text'),
  // numeric
  special('ADD', 'add', [2, 2]),
  special('SUBTRACT', 'subtract', [2, 2]),
  special('MULTIPLY', 'multiply', [2, 2]),
  special('DIVIDE', 'divide', [2, 2]),
  special('MOD', 'modulo', [2, 2]),
  special('POW', 'power', [2, 2]),
  special('SUM', 'sum', [1, MANY]),
  rename('ABS', 'ABS', NUMBER_TO_NUMBER, [1, 1]),
  rename('CEIL', 'CEIL', NUMBER_TO_NUMBER, [1, 1]),
  rename('FLOOR', 'FLOOR', NUMBER_TO_NUMBER, [1, 1]),
  special('SQRT', 'sqrt', [1, 1]),
  rename('EXP', 'EXP', NUMBER_TO_NUMBER, [1, 1]),
  special('LN', 'ln', [1, 1]),
  special('LOG10', 'log10', [1, 1]),
  special('LOG2', 'log2', [1, 1]),
  rename('SIGN', 'SIGN', NUMBER_TO_NUMBER, [1, 1]),
  special(
    'ROUND',
    'round',
    [1, 2],
    'A value exactly halfway rounds away from zero, where Notion rounds a negative one up'
  ),
  special('PI', 'pi', [0, 0]),
  special('E', 'e', [0, 0]),
  degraded('MIN', BLANK_AWARE_MIN_MAX),
  degraded('MAX', BLANK_AWARE_MIN_MAX),
  degraded(
    'MEAN',
    'Averaging skips blank operands in Notion; a formula cannot tell how many were blank'
  ),
  degraded('MEDIAN', 'A median of the arguments of a call has no portable counterpart'),
  unsupported('CBRT', 'Sovrium formulas have no cube root'),
  // date and time
  special('NOW', 'now', [0, 0]),
  special('TODAY', 'today', [0, 0]),
  conditional('YEAR', 'year', [1, 1], WHEN_NOTION_DATE_FIELD),
  conditional('MONTH', 'month', [1, 1], WHEN_NOTION_DATE_FIELD),
  conditional('DATE', 'day', [1, 1], WHEN_NOTION_DATE_FIELD),
  degraded('MINUTE', NOTION_TIME_ZONE),
  degraded('HOUR', NOTION_TIME_ZONE),
  degraded('DAY', NO_WEEKDAY),
  degraded('WEEK', NO_WEEK_NUMBER),
  degraded('DATEADD', NO_DAY_ARITHMETIC),
  degraded('DATESUBTRACT', NO_DAY_ARITHMETIC),
  degraded('DATEBETWEEN', NO_DAY_ARITHMETIC),
  degraded(
    'FORMATDATE',
    "Notion's formatDate tokens are not documented consistently, so no format translates exactly"
  ),
  degraded('PARSEDATE', NOTION_TIME_ZONE),
  degraded('TIMESTAMP', NO_DAY_ARITHMETIC),
  degraded('FROMTIMESTAMP', NO_DAY_ARITHMETIC),
  unsupported('DATERANGE', 'Sovrium has no date-range value'),
  unsupported('DATESTART', 'Sovrium has no date-range value'),
  unsupported('DATEEND', 'Sovrium has no date-range value'),
  // people, pages, lists
  unsupported('NAME', PEOPLE),
  unsupported('EMAIL', PEOPLE),
  degraded(
    'ID',
    'Notion does not document whether id() keeps the hyphens of the page id the import keeps in source_id'
  ),
  ...[
    'AT',
    'FIRST',
    'LAST',
    'SLICE',
    'SORT',
    'REVERSE',
    'JOIN',
    'SPLIT',
    'UNIQUE',
    'INCLUDES',
    'FIND',
    'FINDINDEX',
    'FILTER',
    'SOME',
    'EVERY',
    'MAP',
    'FLAT',
  ].map((name) => unsupported(name, LISTS)),
]

/** Every dialect's function table. */
export const FORMULA_FUNCTION_MAPPINGS: Readonly<
  Record<FormulaDialect, readonly FunctionMapping[]>
> = { airtable: AIRTABLE, notion: NOTION }

/**
 * Look one function up in its dialect's table, by its upper-cased name.
 *
 * An unlisted function is `unsupported`, with a reason naming it.
 */
export const lookupFormulaFunction = (dialect: FormulaDialect, name: string): FunctionMapping =>
  FORMULA_FUNCTION_MAPPINGS[dialect].find((row) => row.source === name) ??
  unsupported(name, `${name}() is not a ${dialect} function this importer knows`)

/** How many rows of a dialect's table land on each outcome. */
export const formulaCoverage = (
  dialect: FormulaDialect
): Readonly<Record<FunctionMapping['outcome'], number>> =>
  FORMULA_FUNCTION_MAPPINGS[dialect].reduce(
    (counts, row) => ({ ...counts, [row.outcome]: counts[row.outcome] + 1 }),
    { mapped: 0, degraded: 0, unsupported: 0 }
  )
