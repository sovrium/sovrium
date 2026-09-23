/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pre-flight check for a SQLite field TYPE change over populated rows.
 *
 * The engine never emits `ALTER COLUMN` on SQLite — and no SQLite version
 * supports the `TYPE` form anyway (see `generateColumnReshapeStatements` in
 * `../schema-migration/migration-statements`) — so a field type change
 * produces no ALTERs and
 * falls through to `recreateTableWithDataEffect`, whose `getCompatibleColumns`
 * copies by NAME only and leans on SQLite type AFFINITY — and affinity does not
 * reject. `'3.9'` lands as a REAL and `'not a number'` lands as TEXT, both in a
 * column the schema declares INTEGER, with nothing logged. Postgres emits
 * `ALTER COLUMN … TYPE … USING …` and aborts the boot instead.
 *
 * The direction is what makes this worth guarding: SQLite is the zero-config
 * default, so the permissive engine is the one an operator validates the edit
 * against. It ships, and the identical edit aborts the production Postgres boot.
 *
 * Three properties, from [internal ref], are the decision rather than decoration:
 *
 * 1. **Refuse, never repair.** Not coerce, not truncate, not quarantine.
 *    Truncating `3.9` to `3` silently falsifies someone's number; dropping the
 *    row is worse. Same stance as `account-issuer-preflight.ts` and
 *    `oauth-client-id-preflight.ts`, whose SHAPE this borrows (pure formatter +
 *    read-only detector) without joining their family — those sit on Layer A
 *    (the baked Drizzle journal), this one on Layer B (dynamic `app.tables[]`).
 * 2. **"Nothing has been changed" is literal.** The detector is read-only and
 *    the caller runs it BEFORE emitting any DDL, so the claim holds by
 *    construction rather than by trusting the surrounding transaction.
 * 3. **Recoverable.** Reverting the field type boots cleanly, every row intact.
 *
 * ## The oracle is Postgres's input function, not JavaScript's
 *
 * The guard is SQLite-only, so its rule must agree with what Postgres's
 * `USING …::<type>` cast does or the two engines merely disagree in a new
 * place. `Number('')` is `0` and `Number('3.9')` is `3.9`, while `''::integer`
 * and `'3.9'::integer` both raise `invalid input syntax`. Both must be REFUSED.
 * `NULL` is not a conversion at all and survives untouched, matching `USING`.
 *
 * ## Scope, deliberately narrow
 *
 * Only three target families carry an oracle here: integer, numeric/decimal and
 * boolean. Date, time, timestamp and JSON targets are NOT judged, and a change
 * into one of them keeps today's permissive behaviour. That is a considered
 * boundary, not an omission: Postgres's date/time input is `DateStyle`-dependent
 * and extraordinarily permissive, so a hand-written model of it would be a
 * false-alarm factory — and a false alarm here blocks a legal upgrade. The
 * families modelled below are the ones whose input grammar is small enough to
 * reproduce exactly.
 */

import { Effect } from 'effect'
import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { mapFieldTypeToPostgres } from '../sql/sql-type-mappings'
import type { SQLExecutionError } from '../sql/sql-execution'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'

/** A target type family whose Postgres input grammar is modelled below. */
export type ConversionTarget = 'integer' | 'numeric' | 'boolean'

/** One column the caller must scan before rebuilding the table. */
export interface TypeChangeProbe {
  /** The physical column name. */
  readonly columnName: string
  /** The config field type the operator wrote, e.g. `integer` — used in the message. */
  readonly targetFieldType: string
  /** Which input grammar decides convertibility. */
  readonly target: ConversionTarget
}

/** One row that cannot be represented in the new type. */
export interface UnconvertibleRow {
  readonly id: string
  readonly value: unknown
}

/** How many offending rows to name before summarising the remainder. */
const MAX_LISTED = 20

/** Postgres `int4` bounds — `'2147483648'::integer` is "out of range", not a syntax error. */
const INT4_MIN = -2_147_483_648
const INT4_MAX = 2_147_483_647

/**
 * Postgres `int4in`: optional surrounding whitespace, optional sign, one or
 * more decimal digits, nothing else. No decimal point, no exponent, no empty
 * string.
 *
 * Postgres 16 additionally accepts `_` digit separators and `0x`/`0o`/`0b`
 * radix prefixes. They are not modelled: being marginally STRICTER than
 * Postgres can only produce a false alarm the operator sees and reverts, and a
 * hex literal sitting in a text column being migrated to `integer` is not a
 * shape worth the extra grammar.
 */
const DECIMAL_INTEGER = /^[+-]?[0-9]+$/

/**
 * Postgres `numeric_in`: optional sign, digits with at most one decimal point
 * (at least one digit overall), optional exponent. `NaN` / `Infinity` / `inf`
 * are accepted spellings and handled separately below.
 */
const DECIMAL_NUMERIC = /^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/

/** The non-finite spellings `numeric_in` accepts, lower-cased and unsigned. */
const NUMERIC_NON_FINITE = new Set(['nan', 'infinity', 'inf'])

/**
 * Every spelling Postgres's `parse_bool_with_len` accepts, lower-cased.
 *
 * It matches unique leading PREFIXES of the long forms, which is why `o` is
 * absent (ambiguous between `on` and `off`) while `of` is present.
 */
const BOOLEAN_SPELLINGS = new Set([
  't',
  'tr',
  'tru',
  'true',
  'f',
  'fa',
  'fal',
  'fals',
  'false',
  'y',
  'ye',
  'yes',
  'n',
  'no',
  'on',
  'of',
  'off',
  '1',
  '0',
])

/**
 * The text Postgres would hold for a value SQLite handed back.
 *
 * On Postgres the source column is `VARCHAR`/`TEXT`, so every value IS text and
 * the oracle is a text oracle. SQLite's affinity is looser — a numeric literal
 * inserted into a TEXT-declared column keeps INTEGER or REAL storage — so a
 * non-string is rendered to the text Postgres would have stored before applying
 * the same rule. A BLOB has no such rendering and is refused outright.
 */
const asPostgresText = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return undefined
}

/** Whether `'<text>'::integer` would succeed in Postgres. */
const convertsToInteger = (text: string): boolean => {
  const trimmed = text.trim()
  if (!DECIMAL_INTEGER.test(trimmed)) return false
  const parsed = Number(trimmed)
  return Number.isSafeInteger(parsed) && parsed >= INT4_MIN && parsed <= INT4_MAX
}

/**
 * Whether `'<text>'::numeric` would succeed in Postgres.
 *
 * SYNTAX only. A value whose integer part overflows the declared
 * `NUMERIC(p,s)` is left to the engine: Sovrium's numeric mapping allows 18
 * integer digits, so overflow needs a value above 10^18, and on SQLite the
 * column carries plain `NUMERIC` affinity and is not constrained anyway.
 * Modelling it would add a boundary this guard cannot test against a real
 * Postgres.
 */
const convertsToNumeric = (text: string): boolean => {
  const trimmed = text.trim()
  if (DECIMAL_NUMERIC.test(trimmed)) return true
  return NUMERIC_NON_FINITE.has(trimmed.replace(/^[+-]/, '').toLowerCase())
}

/** Whether `'<text>'::boolean` would succeed in Postgres. */
const convertsToBoolean = (text: string): boolean =>
  BOOLEAN_SPELLINGS.has(text.trim().toLowerCase())

/**
 * Whether one stored value survives the conversion Postgres would perform.
 *
 * `null` is not a conversion — `USING` yields `NULL` for `NULL` — so it is
 * always convertible and never named in a refusal.
 *
 * @public
 */
export const isConvertibleValue = (value: unknown, target: ConversionTarget): boolean => {
  if (value === null || value === undefined) return true
  const text = asPostgresText(value)
  if (text === undefined) return false
  if (target === 'integer') return convertsToInteger(text)
  if (target === 'numeric') return convertsToNumeric(text)
  return convertsToBoolean(text)
}

/**
 * The conversion family a Postgres column type belongs to, or `undefined` when
 * this guard has no oracle for it (see the scope note at the top of the file).
 */
const conversionTargetOf = (postgresType: string): ConversionTarget | undefined => {
  const upper = postgresType.toUpperCase().trim()
  if (upper.endsWith('[]')) return undefined
  if (upper === 'INTEGER' || upper === 'SMALLINT' || upper === 'BIGINT') return 'integer'
  if (upper.startsWith('NUMERIC') || upper.startsWith('DECIMAL')) return 'numeric'
  if (upper === 'REAL' || upper === 'DOUBLE PRECISION') return 'numeric'
  if (upper === 'BOOLEAN') return 'boolean'
  return undefined
}

/** The Postgres type a field maps to, or `undefined` for an unmappable field. */
const postgresTypeOf = (field: Fields[number]): string | undefined => {
  try {
    return mapFieldTypeToPostgres(field)
  } catch {
    // An unknown field type throws here and is reported by the DDL generator
    // with a better message. Silence is right: this guard must never be the
    // thing that fails a boot for a reason unrelated to data conversion.
    return undefined
  }
}

/** The previously-migrated definition of one table, as raw snapshot JSON. */
type PreviousTableShape = { readonly fields?: readonly { readonly name?: unknown }[] }

const findPreviousFields = (
  tableName: string,
  previousSchema?: { readonly tables: readonly object[] }
): ReadonlyMap<string, Fields[number]> => {
  const previousTable = previousSchema?.tables.find(
    (t): t is object & { name?: unknown } =>
      typeof t === 'object' &&
      t !== null &&
      'name' in t &&
      (t as { name?: unknown }).name === tableName
  ) as (PreviousTableShape & object) | undefined
  const fields = previousTable?.fields ?? []
  return new Map(
    fields.filter((f): f is Fields[number] => typeof f?.name === 'string').map((f) => [f.name, f])
  )
}

/**
 * Which columns of this table must be scanned before it is rebuilt.
 *
 * Pure, and cheap enough to run on every migrating boot: it touches the config
 * and the live column MAP, never the rows.
 *
 * The trigger is the CONFIG field-type change, not a declared-type diff, because
 * the SQLite declared type is LOSSY — `mapPostgresTypeToSqlite` collapses
 * `VARCHAR(n)` to `TEXT` and `NUMERIC(p,s)` to bare `NUMERIC`, so diffing the
 * strings both misses real changes and invents fake ones. The live declared type
 * is read as a HINT, for the exclusion below.
 *
 * Five exclusions, each of which would otherwise re-litigate an existing spec:
 *
 * - A column absent from the live table is being ADDED — there are no rows.
 * - A field absent from the previous snapshot cannot be shown to be changing.
 *   With no snapshot at all the probe list is empty and behaviour is unchanged.
 * - A change WITHIN one family (`single-line-text` → `long-text`, or a
 *   `precision` narrowing) converts nothing.
 * - A target family with no oracle is not judged.
 * - **The live column must not already hold a judged scalar.** This is the
 *   load-bearing one, and it is a statement about Postgres rather than a
 *   conservatism: a TEXT column reaches its new type through Postgres's INPUT
 * FUNCTION, which is the oracle [internal ref] adopts, while a column already holding
 *   a scalar reaches it through a CAST function with entirely different
 *   semantics — `numeric → integer` ROUNDS rather than failing, and
 *   `integer → boolean` maps non-zero to true. Judging those by the input
 *   function would refuse edits Postgres accepts, which is a false alarm
 *   blocking a legal upgrade. It is also what makes this planner
 *   dialect-agnostic, so the read-only CLI modes can reuse it on Postgres, where
 *   the live type reads `character varying`.
 *
 *   Stated precisely rather than loosely: the test is "does the live type
 *   classify into integer / numeric / boolean", not "is it literally text". A
 *   live `timestamp`, `date` or `jsonb` therefore still reaches the scan — and
 *   is refused, since none of its values parse as the target. That direction is
 *   correct for the wrong-looking reason: Postgres has no cast from those types
 *   to `integer` at all, so the boot would abort regardless, and refusing early
 *   with named rows beats aborting late with a cast error.
 *
 * @public
 */
export const planTypeChangeProbes = (params: {
  readonly table: Table
  readonly existingColumns: ReadonlyMap<string, { readonly dataType: string }>
  readonly previousSchema?: { readonly tables: readonly object[] }
}): readonly TypeChangeProbe[] => {
  const { table, existingColumns, previousSchema } = params
  const previousFields = findPreviousFields(table.name, previousSchema)
  if (previousFields.size === 0) return []

  return table.fields.flatMap((field): readonly TypeChangeProbe[] => {
    const live = existingColumns.get(field.name)
    if (!live) return []
    const previousField = previousFields.get(field.name)
    if (!previousField || previousField.type === field.type) return []

    const currentPostgres = postgresTypeOf(field)
    const previousPostgres = postgresTypeOf(previousField)
    if (currentPostgres === undefined || previousPostgres === undefined) return []

    const target = conversionTargetOf(currentPostgres)
    if (target === undefined) return []
    if (conversionTargetOf(previousPostgres) !== undefined) return []

    // The declared-type hint. A live column that already classifies into a
    // scalar family is not converted by an input function, so this guard has no
    // standing to judge it — see the exclusion note above.
    if (conversionTargetOf(live.dataType) !== undefined) return []

    return [{ columnName: field.name, targetFieldType: field.type, target }]
  })
}

/**
 * The operator-facing refusal.
 *
 * Pure, so the wording is unit-testable without a database. The shape is the one
 * [internal ref] specifies: the qualified column, the target type, a row COUNT, and
 * each offending row by id AND by value — the id is what the operator queries
 * on, the value is what tells them why. Rows that convert cleanly are never
 * named, so the message does not send anyone to edit data that is already fine.
 *
 * @public
 */
export const formatTypeChangeRefusal = (params: {
  readonly tableName: string
  readonly probe: TypeChangeProbe
  readonly rows: readonly UnconvertibleRow[]
}): string => {
  const { tableName, probe, rows } = params
  const listed = rows
    .slice(0, MAX_LISTED)
    .map(
      (row) => `    id ${row.id}: ${JSON.stringify(asPostgresText(row.value) ?? String(row.value))}`
    )
    .join('\n')
  const remainder =
    rows.length > MAX_LISTED ? `\n    … and ${rows.length - MAX_LISTED} more row(s)` : ''
  const plural = rows.length === 1 ? 'row' : 'rows'
  return [
    `${rows.length} ${plural} in \`${tableName}.${probe.columnName}\` cannot become ${probe.targetFieldType}`,
    '',
    `${listed}${remainder}`,
    '',
    'Revert the field type, or clean these rows first.',
    'Nothing has been changed.',
  ].join('\n')
}

/**
 * The read-only query that lists the values one probe must judge.
 *
 * `NULL` is excluded in SQL rather than in JavaScript: it is never a conversion
 * failure, and leaving it out keeps the result set proportional to the data that
 * could actually be at fault.
 *
 * @public
 */
export const buildProbeQuery = (params: {
  readonly physicalTableName: string
  readonly idColumn: string
  readonly columnName: string
}): string => {
  const column = quoteSqlIdentifier(params.columnName)
  return [
    `SELECT ${quoteSqlIdentifier(params.idColumn)} AS preflight_id, ${column} AS preflight_value`,
    `FROM ${quoteSqlIdentifier(params.physicalTableName)}`,
    `WHERE ${column} IS NOT NULL`,
  ].join(' ')
}

/**
 * Turn driver rows into the offending subset.
 *
 * @public
 */
export const selectUnconvertibleRows = (
  rows: readonly Record<string, unknown>[],
  target: ConversionTarget
): readonly UnconvertibleRow[] =>
  rows
    .filter((row) => !isConvertibleValue(row['preflight_value'], target))
    .map((row) => ({ id: String(row['preflight_id']), value: row['preflight_value'] }))

/**
 * Scan one table's changing columns and describe every refusal, changing
 * nothing.
 *
 * Read-only by construction — it issues `SELECT`s and returns text — so callers
 * that must not write (the `sovrium migrate --dry-run` / `--check` paths, where
 * no transaction exists at all) can reuse it verbatim.
 *
 * Cost is one sequential scan per CHANGING column, which is why
 * {@link planTypeChangeProbes} is the gate: on a boot that changes no field
 * type the probe list is empty and no query is issued.
 *
 * @public
 */
export const detectUnconvertibleRows = (params: {
  readonly query: (sql: string) => Effect.Effect<readonly unknown[], SQLExecutionError>
  readonly tableName: string
  readonly physicalTableName: string
  readonly idColumn: string
  readonly probes: readonly TypeChangeProbe[]
}): Effect.Effect<readonly string[], SQLExecutionError> =>
  Effect.forEach(params.probes, (probe) =>
    Effect.gen(function* () {
      const rows = yield* params.query(
        buildProbeQuery({
          physicalTableName: params.physicalTableName,
          idColumn: params.idColumn,
          columnName: probe.columnName,
        })
      )
      const offenders = selectUnconvertibleRows(
        rows as readonly Record<string, unknown>[],
        probe.target
      )
      return offenders.length === 0
        ? []
        : [formatTypeChangeRefusal({ tableName: params.tableName, probe, rows: offenders })]
    })
  ).pipe(Effect.map((results) => results.flat()))

/**
 * The column a refusal identifies its rows by.
 *
 * `id` when the table has one — the name every Sovrium-generated table uses and
 * the one an operator will write into a `WHERE` clause. `rowid` otherwise, so a
 * table with a custom primary key still names its rows rather than reporting a
 * bare count.
 *
 * @public
 */
export const resolveProbeIdColumn = (existingColumns: ReadonlyMap<string, unknown>): string =>
  existingColumns.has('id') ? 'id' : 'rowid'
