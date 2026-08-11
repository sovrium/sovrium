/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Resolve the foreign-key column a `count` / `rollup` field must traverse.
 *
 * A `count` or `rollup` aggregates the CHILD table's rows, so the generated
 * subquery needs the name of the FK column ON THE CHILD. Three declared shapes
 * answer that directly:
 *
 *   1. `foreignKey` on the parent's relationship field — states the child column
 *      outright and always wins.
 *   2. `reciprocalField` — names the child's relationship field, which for a
 *      `many-to-one` IS the FK column.
 *   3. Any relation direction other than `one-to-many` — there the parent's own
 *      relationship field is the FK column, so its name is the answer.
 *
 * For a `one-to-many` declaring neither (1) nor (2) the answer must be INFERRED
 * from the child, and the parent's field name is emphatically NOT it: that name
 * describes the collection on the parent (`movements`), never a column on the
 * child. Emitting it produces SQL referencing a column that does not exist, and
 * every read of the table fails.
 *
 * Inference looks for relationship fields on the child pointing back at the
 * parent. Exactly one candidate is the overwhelmingly common shape and is safe
 * to adopt. Zero or several is NOT guessable — a child referencing the parent as
 * both `origin` and `destination` has no defensible default — so those resolve
 * to an explicit "unresolvable" answer that the caller reports as a config
 * error, rather than to a plausible-looking wrong column.
 *
 * Pure and dependency-free so the DDL generator and the startup validator agree
 * by construction: the config that boots is exactly the config whose SQL can be
 * generated.
 */

/** Structural view of a field, satisfied by both raw config and decoded models. */
export interface RelationshipFieldLike {
  readonly name: string
  readonly type?: string
  readonly relatedTable?: string
  readonly relationType?: string
  readonly foreignKey?: string
  readonly reciprocalField?: string
}

/** Structural view of a table, satisfied by both raw config and decoded models. */
export interface RelationshipTableLike {
  readonly name: string
  readonly fields?: readonly RelationshipFieldLike[]
}

/**
 * The outcome of resolving a child-side foreign-key column.
 *
 * `unresolvable` carries every candidate found so the caller can name them in
 * the error: an author told "ambiguous" without being told between WHAT has to
 * go read the config back themselves.
 */
export type ForeignKeyResolution =
  | { readonly resolved: true; readonly column: string }
  | { readonly resolved: false; readonly candidates: readonly string[] }

/**
 * Relation directions whose relationship field is a real FK COLUMN on the table
 * that declares it. `many-to-one` is the canonical child side. An undeclared
 * direction is treated the same way because the field still materialises as a
 * column. `one-to-many` and `many-to-many` are excluded: neither puts a column
 * on the declaring table, so neither can be the FK a parent traverses.
 */
const declaresForeignKeyColumn = (relationType: string | undefined): boolean =>
  relationType === undefined || relationType === 'many-to-one' || relationType === 'one-to-one'

/**
 * Relationship fields on `childTable` that point back at `parentTableName` and
 * carry a real FK column — the candidate set inference chooses from.
 */
export const findForeignKeyCandidates = (
  childTable: RelationshipTableLike | undefined,
  parentTableName: string
): readonly string[] =>
  (childTable?.fields ?? [])
    .filter(
      (field) =>
        field.type === 'relationship' &&
        field.relatedTable === parentTableName &&
        declaresForeignKeyColumn(field.relationType)
    )
    .map((field) => field.name)

export interface ResolveForeignKeyInput {
  /** The parent's relationship field the `count` / `rollup` traverses. */
  readonly relationshipField: RelationshipFieldLike
  /** The table declaring the `count` / `rollup` field. */
  readonly parentTableName: string
  /**
   * The related (child) table, when it is in scope. `undefined` means the caller
   * could not supply it — inference is impossible and the historical
   * field-name answer is kept rather than failing a config that may be fine.
   */
  readonly childTable: RelationshipTableLike | undefined
}

/**
 * Resolve the child-side FK column, or report the candidates that made it
 * unresolvable.
 */
export const resolveRelationshipForeignKey = (
  input: ResolveForeignKeyInput
): ForeignKeyResolution => {
  const { relationshipField, parentTableName, childTable } = input

  if (typeof relationshipField.foreignKey === 'string') {
    return { resolved: true, column: relationshipField.foreignKey }
  }
  if (typeof relationshipField.reciprocalField === 'string') {
    return { resolved: true, column: relationshipField.reciprocalField }
  }
  if (relationshipField.relationType !== 'one-to-many') {
    return { resolved: true, column: relationshipField.name }
  }
  if (childTable === undefined) {
    return { resolved: true, column: relationshipField.name }
  }

  const candidates = findForeignKeyCandidates(childTable, parentTableName)
  return candidates.length === 1 && candidates[0] !== undefined
    ? { resolved: true, column: candidates[0] }
    : { resolved: false, candidates }
}

/**
 * Author-facing explanation of an unresolvable foreign key.
 *
 * Names the computed field, the relationship, and every candidate, because the
 * fix is always the same edit — declare `foreignKey` — and the author needs to
 * know which column to declare.
 */
export const formatForeignKeyResolutionError = (input: {
  readonly parentTableName: string
  readonly computedFieldName: string
  readonly relationshipFieldName: string
  readonly childTableName: string
  readonly candidates: readonly string[]
}): string => {
  const { parentTableName, computedFieldName, relationshipFieldName } = input
  const { childTableName, candidates } = input
  const subject = `Table '${parentTableName}' field '${computedFieldName}' cannot resolve the foreign key for one-to-many relationship '${relationshipFieldName}'`

  return candidates.length === 0
    ? `${subject}: table '${childTableName}' declares no relationship back to '${parentTableName}'. Add a many-to-one relationship on '${childTableName}', or declare foreignKey on '${relationshipFieldName}'.`
    : `${subject}: table '${childTableName}' declares ${candidates.length} relationships back to '${parentTableName}' (${candidates.join(', ')}), so the foreign key is ambiguous. Declare foreignKey on '${relationshipFieldName}' to choose one.`
}
