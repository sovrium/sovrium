/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  formatForeignKeyResolutionError,
  resolveRelationshipForeignKey,
  type RelationshipFieldLike,
  type RelationshipTableLike,
} from '@/domain/models/app/tables/relationship-foreign-key'

/**
 * Refuse a config whose `count` / `rollup` fields traverse a one-to-many whose
 * foreign key cannot be determined.
 *
 * Such a config used to validate clean and then fail on EVERY read and write of
 * the table, because the generated SQL named a column that does not exist. A
 * green validation followed by a permanently broken table is the worst of both
 * worlds: the author has no signal, and the failure surfaces far from its cause.
 *
 * Scope is deliberately narrow — only relationships actually traversed by a
 * `count` or `rollup` are checked. Those are precisely the shapes that reach the
 * foreign-key resolver; a one-to-many nobody aggregates over emits no such SQL
 * and has nothing to be ambiguous about, so failing it would be a tax with no
 * defect behind it.
 */

interface ComputedFieldLike extends RelationshipFieldLike {
  readonly relationshipField?: string
}

interface TableLike extends RelationshipTableLike {
  readonly fields?: readonly ComputedFieldLike[]
}

const COMPUTED_FIELD_TYPES = new Set(['count', 'rollup'])

/**
 * Validate one computed field, returning its error message or nothing.
 *
 * A computed field whose `relationshipField` names something that is not a
 * relationship is left alone: the AppSchema cross-reference rules own that
 * failure, and duplicating it here would report the same problem twice in two
 * different vocabularies.
 */
const checkComputedField = (
  table: TableLike,
  computedField: ComputedFieldLike,
  allTables: readonly TableLike[]
): readonly string[] => {
  const relationshipFieldName = computedField.relationshipField
  if (relationshipFieldName === undefined) return []

  const relationshipField = table.fields?.find((f) => f.name === relationshipFieldName)
  if (!relationshipField || relationshipField.type !== 'relationship') return []

  const childTableName = relationshipField.relatedTable
  const childTable = allTables.find((t) => t.name === childTableName)

  const resolution = resolveRelationshipForeignKey({
    relationshipField,
    parentTableName: table.name,
    childTable,
  })
  if (resolution.resolved) return []

  return [
    formatForeignKeyResolutionError({
      parentTableName: table.name,
      computedFieldName: computedField.name,
      relationshipFieldName,
      childTableName: childTableName ?? '<unknown>',
      candidates: resolution.candidates,
    }),
  ]
}

/**
 * Typed against the DECODED config rather than `unknown`.
 *
 * The check reads exactly one property, `tables`. Taking `unknown` and reaching
 * for it through a cast would make a rename of that property compile
 * cleanly and turn this validator into a silent no-op — which is the precise
 * failure mode it exists to prevent elsewhere. Naming the type means the
 * compiler, not a spec run, is the thing that notices.
 *
 * PURE, AND A PLAIN FUNCTION. It reads one property of a decoded object and
 * returns strings; nothing it does is an effect. Wrapping the result in
 * `Effect.fail` only obliged its single caller to run a fiber to unwrap it
 * again — a synchronous one, inside a synchronous decode — which is the shape
 * standing rule E1 exists to remove. Returning the list says the same thing
 * and composes with the caller's other checks by concatenation.
 *
 * @param app - Decoded app config
 * @returns one message per unresolvable foreign key; empty when every computed
 *   field can name its column.
 */
export const validateComputedFieldForeignKeys = (
  app: Readonly<{ readonly tables?: readonly TableLike[] }>
): readonly string[] => {
  const allTables = app.tables ?? []
  return allTables.flatMap((table) =>
    (table.fields ?? [])
      .filter((field) => typeof field.type === 'string' && COMPUTED_FIELD_TYPES.has(field.type))
      .flatMap((field) => checkComputedField(table, field, allTables))
  )
}
