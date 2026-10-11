/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Write-only fields — `writeOnly: true` on a `single-line-text` or
 * `long-text` field: a value people and automations WRITE, that no read path
 * returns to any role, the admin included.
 *
 * The read predicate (`isFieldReadableByCaller`) refuses such a field before
 * its admin bypass, so every door built on it drops the value. What is here is
 * the rest: the field lookup itself, and the shapes a stored change takes when
 * it must still be NAMED without being kept (the record history).
 */

/** What a write-only value is recorded as where it is named but not kept. */
export const WRITE_ONLY_MASK = '***'

/** The table shape these helpers read — a decoded table, or a projection of one. */
interface WriteOnlyTable {
  readonly name: string
  readonly fields: ReadonlyArray<{ readonly name: string }>
}

/** Whether a declared field carries `writeOnly: true`. */
export const declaresWriteOnly = (field: object): boolean =>
  'writeOnly' in field && (field as { readonly writeOnly?: unknown }).writeOnly === true

/** The names of the write-only fields `tableName` declares, in declaration order. */
export const writeOnlyFieldNames = (
  app: { readonly tables?: ReadonlyArray<WriteOnlyTable> | undefined },
  tableName: string
): readonly string[] =>
  (app.tables?.find((table) => table.name === tableName)?.fields ?? [])
    .filter(declaresWriteOnly)
    .map((field) => field.name)

/** Whether `fieldName` on `tableName` is declared `writeOnly: true`. */
export const isWriteOnlyField = (
  app: { readonly tables?: ReadonlyArray<WriteOnlyTable> | undefined },
  tableName: string,
  fieldName: string
): boolean => writeOnlyFieldNames(app, tableName).includes(fieldName)

/** Every table of the app with at least one write-only field, mapped to their names. */
export const writeOnlyColumnsOf = (app: {
  readonly tables?: ReadonlyArray<WriteOnlyTable> | undefined
}): ReadonlyMap<string, ReadonlySet<string>> =>
  new Map(
    (app.tables ?? []).flatMap((table) => {
      const names = writeOnlyFieldNames(app, table.name)
      return names.length === 0 ? [] : [[table.name, new Set(names)] as const]
    })
  )

/** Whether a stored value counts as set: anything but `null`, `undefined` and `''`. */
export const isStoredValue = (value: unknown): boolean =>
  value !== null && value !== undefined && value !== ''

type Row = Readonly<Record<string, unknown>>

const maskedSide = (row: Row, columns: ReadonlySet<string>, keep: (name: string) => boolean) =>
  Object.fromEntries(
    Object.entries(row).flatMap(([name, value]) => {
      if (!columns.has(name)) return [[name, value] as const]
      if (!keep(name)) return []
      return [[name, isStoredValue(value) ? WRITE_ONLY_MASK : ''] as const]
    })
  )

/**
 * A record-history change set with its write-only values removed, the change
 * still named. Each write-only column is kept as {@link WRITE_ONLY_MASK} when
 * a value is stored (`''` when not) — on both sides of an update only when
 * the value changed, so an update that left the secret alone does not name
 * it. Neither value is ever kept.
 */
export const maskWriteOnlyChanges = (
  changes: { readonly before?: Row | undefined; readonly after?: Row | undefined },
  columns: ReadonlySet<string> | undefined
): { readonly before?: Row; readonly after?: Row } => {
  const { before, after } = changes
  if (columns === undefined || columns.size === 0) {
    return {
      ...(before === undefined ? {} : { before }),
      ...(after === undefined ? {} : { after }),
    }
  }
  const changed = (name: string): boolean =>
    before === undefined || after === undefined || before[name] !== after[name]
  return {
    ...(before === undefined ? {} : { before: maskedSide(before, columns, changed) }),
    ...(after === undefined ? {} : { after: maskedSide(after, columns, changed) }),
  }
}

/**
 * `row` without the write-only fields of `tableName` — for a copy kept where
 * people read it (a submission ledger, an account export), which keeps none.
 */
export const withoutWriteOnlyValues = (
  app: { readonly tables?: ReadonlyArray<WriteOnlyTable> | undefined },
  tableName: string | undefined,
  row: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const hidden = new Set(tableName === undefined ? [] : writeOnlyFieldNames(app, tableName))
  if (hidden.size === 0) return row
  return Object.fromEntries(Object.entries(row).filter(([key]) => !hidden.has(key)))
}
