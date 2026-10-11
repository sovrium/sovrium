/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a write-only field cannot be combined with.
 *
 * A write-only value is read back by no one, so anything that would answer a
 * question about it is refused when the config is read:
 *
 * - `unique` on the field, or a table `unique` entry or unique index naming
 *   it: a write whose guess matches a stored value answers 409;
 * - `fullTextSearch`: a word search returns the rows whose value holds the word;
 * - a view grouping or sorting on it: a group is named by the stored value,
 *   and an order discloses the values row against row;
 * - a formula naming it, an AI field taking it as a source, a lookup or a
 *   rollup reading it, a relationship showing it as its `displayField`: each
 *   copies the value somewhere people read it.
 */

import { extractFieldReferences } from './table-formula-validation'
import { declaresWriteOnly } from './write-only-field-service'

/** The slice of a field these checks read. */
interface FieldLike {
  readonly name: string
  readonly type: string
  readonly [option: string]: unknown
}

/** The slice of a table these checks read. */
interface TableLike {
  readonly name: string
  readonly fields: readonly FieldLike[]
  readonly unique?: ReadonlyArray<{ readonly fields: ReadonlyArray<string> }> | undefined
  readonly indexes?:
    | ReadonlyArray<{
        readonly name: string
        readonly fields: ReadonlyArray<string>
        readonly unique?: boolean | undefined
      }>
    | undefined
  readonly views?: ReadonlyArray<ViewLike> | undefined
}

/** The slice of a view these checks read: the fields it groups and sorts on. */
interface ViewLike {
  readonly id: string | number
  readonly groupBy?:
    | {
        readonly field: string
        readonly thenBy?: ReadonlyArray<{ readonly field: string }> | undefined
      }
    | undefined
  readonly sorts?: ReadonlyArray<{ readonly field: string }> | undefined
}

type ValidationError = { readonly message: string; readonly path: ReadonlyArray<string> }

/** The value of an option a field declares, read without assuming its type has it. */
const optionOf = (field: FieldLike, option: string): unknown => field[option]

/** The options a write-only field refuses on itself. */
const REFUSED_OPTIONS = ['unique', 'fullTextSearch'] as const

/**
 * The first problem a write-only field of `table` has with its own table:
 * `unique` or `fullTextSearch` on it, a table `unique` entry naming it, or a
 * formula reading it. `undefined` when there is none.
 */
export const validateWriteOnlyFields = (table: TableLike): ValidationError | undefined => {
  const writeOnly = table.fields.filter(declaresWriteOnly).map((field) => field.name)
  if (writeOnly.length === 0) return undefined
  const ownOption = table.fields
    .flatMap((field, index) =>
      REFUSED_OPTIONS.filter(
        (option) => declaresWriteOnly(field) && optionOf(field, option) === true
      ).map((option) => ({ field: field.name, index, option }))
    )
    .at(0)
  if (ownOption !== undefined) {
    return {
      message: `Field "${ownOption.field}": writeOnly cannot be combined with ${ownOption.option} — it would answer questions about a value no one may read`,
      path: ['fields', String(ownOption.index), ownOption.option],
    }
  }
  const uniqueEntry = [
    ...(table.unique ?? []).map((entry, position) => ({
      fields: entry.fields,
      path: ['unique', String(position)],
    })),
    ...(table.indexes ?? []).flatMap((index, position) =>
      index.unique === true
        ? [{ fields: index.fields, path: ['indexes', String(position), 'unique'] }]
        : []
    ),
  ]
    .map((entry) => ({ ...entry, field: entry.fields.find((name) => writeOnly.includes(name)) }))
    .find((entry) => entry.field !== undefined)
  if (uniqueEntry?.field !== undefined) {
    return {
      message: `Field "${uniqueEntry.field}": writeOnly cannot be combined with unique — ${uniqueEntry.path.join('.')} names it, and a 409 would confirm a guess`,
      path: uniqueEntry.path,
    }
  }
  const viewError = viewOrderingError(table.views ?? [], writeOnly)
  if (viewError !== undefined) return viewError
  const reader = table.fields
    .map((field, index) => ({ field, index }))
    .flatMap(({ field, index }) => {
      const read = sameTableReads(field).find((name) => writeOnly.includes(name))
      return read === undefined
        ? []
        : [{ field: field.name, index, read, option: readingOption(field) }]
    })
    .at(0)
  return reader === undefined
    ? undefined
    : {
        message: `Field "${reader.field}" cannot read writeOnly field "${reader.read}" — it would copy a value no one may read`,
        path: ['fields', String(reader.index), reader.option],
      }
}

/** The first view grouping or sorting on one of `writeOnly`, as a problem. */
const viewOrderingError = (
  views: ReadonlyArray<ViewLike>,
  writeOnly: readonly string[]
): ValidationError | undefined => {
  const found = views
    .map((view, index) => ({
      view,
      index,
      grouped: [view.groupBy?.field, ...(view.groupBy?.thenBy ?? []).map((level) => level.field)],
      sorted: (view.sorts ?? []).map((sort) => sort.field),
    }))
    .flatMap(({ view, index, grouped, sorted }) => [
      ...grouped
        .filter((name): name is string => name !== undefined && writeOnly.includes(name))
        .map((field) => ({ view, index, field, option: 'groupBy' })),
      ...sorted
        .filter((name) => writeOnly.includes(name))
        .map((field) => ({ view, index, field, option: 'sorts' })),
    ])
    .at(0)
  return found === undefined
    ? undefined
    : {
        message: `View "${String(found.view.id)}" cannot ${found.option === 'groupBy' ? 'group' : 'sort'} on writeOnly field "${found.field}" — it would disclose a value no one may read`,
        path: ['views', String(found.index), found.option],
      }
}

/** The option through which a field reads its own table's fields: a formula, or an AI field's sources. */
const readingOption = (field: FieldLike): string =>
  field.type === 'formula' ? 'formula' : 'sourceFields'

/** The fields of its own table one field reads: a formula's references, an AI field's sources. */
const sameTableReads = (field: FieldLike): readonly string[] => {
  const expression = optionOf(field, 'formula')
  if (field.type === 'formula') {
    return typeof expression === 'string' ? extractFieldReferences(expression) : []
  }
  const sources = optionOf(field, 'sourceFields')
  return Array.isArray(sources)
    ? sources.filter((name): name is string => typeof name === 'string')
    : []
}

/** The table a lookup or rollup of `table` reads through `relationshipField`. */
const relatedTableOf = (
  table: TableLike,
  relationshipField: unknown,
  tables: readonly TableLike[]
): TableLike | undefined => {
  const own = table.fields.find(
    (field) => field.name === relationshipField && field.type === 'relationship'
  )
  const ownTarget = own === undefined ? undefined : optionOf(own, 'relatedTable')
  if (typeof ownTarget === 'string') return tables.find((other) => other.name === ownTarget)
  return tables.find(
    (other) =>
      other.name !== table.name &&
      other.fields.some(
        (field) =>
          field.name === relationshipField &&
          field.type === 'relationship' &&
          optionOf(field, 'relatedTable') === table.name
      )
  )
}

/** Whether `fieldName` on `table` is write-only. */
const isWriteOnlyIn = (table: TableLike | undefined, fieldName: unknown): boolean =>
  table?.fields.some((field) => field.name === fieldName && declaresWriteOnly(field)) === true

/** The write-only field one field of `table` reads from another table, if any. */
const crossTableRead = (
  table: TableLike,
  field: FieldLike,
  tables: readonly TableLike[]
): string | undefined => {
  if (field.type === 'lookup' || field.type === 'rollup') {
    const related = relatedTableOf(table, optionOf(field, 'relationshipField'), tables)
    const read = optionOf(field, 'relatedField')
    return isWriteOnlyIn(related, read) ? `${related?.name}.${String(read)}` : undefined
  }
  if (field.type === 'relationship') {
    const related = tables.find((other) => other.name === optionOf(field, 'relatedTable'))
    const shown = optionOf(field, 'displayField')
    return isWriteOnlyIn(related, shown) ? `${related?.name}.${String(shown)}` : undefined
  }
  return undefined
}

/**
 * The first lookup, rollup or relationship `displayField` across `tables` that
 * reads a write-only field of another table, as a message — or `undefined`.
 */
export const validateWriteOnlyReads = (tables: readonly TableLike[]): string | undefined => {
  const found = tables
    .flatMap((table) =>
      table.fields.flatMap((field) => {
        const read = crossTableRead(table, field, tables)
        return read === undefined ? [] : [{ at: `${table.name}.${field.name}`, read }]
      })
    )
    .at(0)
  return found === undefined
    ? undefined
    : `Field "${found.at}" cannot read writeOnly field "${found.read}": a lookup, a rollup or a relationship label would show a value no one may read`
}
