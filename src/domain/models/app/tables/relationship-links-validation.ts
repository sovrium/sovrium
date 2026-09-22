/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Canonical write-path rule for a `relationship` column's declared link cap —
 * "no more linked records than `maxLinked` allows" — shared by every write path
 * that accepts values for one. That claim is checkable rather than aspirational:
 * exactly three aggregate seams reach this rule, and between them they cover
 * every such route — `validateRecordCreation` (single create),
 * `validateUpdateFieldValues` (single `PATCH` and the bulk form verb) and
 * `validateBulkFieldValues` (batch create, batch update, upsert).
 *
 * It was false when first written: the rule reached the two single-record seams
 * and stopped, so all three bulk routes wrote past the cap — and because no
 * engine can enforce this one (below), nothing downstream caught them. Adding a
 * fourth seam without adding it here is how that recurs.
 *
 * Why this module exists: `maxLinked` is a NEW declaration and the
 * database cannot enforce it on either engine. A `many-to-many` link set is not
 * a column at all — it is rows in a junction table — so there is no column-level
 * CHECK to hang a cardinality rule on, and the `<@`-style member CHECK that
 * covers `multi-select` on PostgreSQL has no analogue here even in principle.
 * The records API is therefore the ONLY seam where both engines can be held to
 * one contract, exactly as it is for `multi-select` cardinality.
 *
 * Modelled deliberately on {@link findMultiSelectSelectionOverflows} in
 * `multi-select-values.ts`: same INCLUSIVE boundary, same
 * present-in-payload-only scope, same "report which columns were violated,
 * never how to phrase it" split. A second, subtly different cardinality rule
 * beside the first is the drift this shape exists to avoid.
 */

/** Minimal structural shape this module needs from a table's field list. */
type FieldDeclaration = {
  readonly name: string
  readonly type: string
}

/** One `relationship` column linking more records than it permits. */
export type RelationshipLinkOverflow = {
  readonly field: string
  readonly maxLinked: number
  readonly linked: number
}

/**
 * How many records a supplied column value links to.
 *
 * A NON-ARRAY value counts as zero links rather than one. That is deliberate:
 * `maxLinked` is only meaningful on a picker that can hold more than one link,
 * so a scalar foreign key is by construction within any cap above zero — and
 * `maxLinked` is constrained to be above zero by its own schema. Counting a
 * scalar as one link would make the rule fire on `maxLinked: 1`… which is the
 * same answer, so the distinction is invisible in behaviour and the simpler
 * reading is kept.
 *
 * `undefined` / `null` mean no links were supplied (or the field is being
 * cleared) and yield zero, so clearing an optional relationship can never be
 * refused for linking too much.
 */
const linkedCount = (value: unknown): number => (Array.isArray(value) ? value.length : 0)

/**
 * Every `relationship` column in `values` linking more records than its declared
 * `maxLinked` permits, in table field-declaration order.
 *
 * The boundary is INCLUSIVE — exactly `maxLinked` links is allowed, which is
 * what `maxLinked` means. A column without a declared `maxLinked` is uncapped
 * and never reported.
 *
 * Only columns PRESENT in `values` are inspected (`field.name in values`). This
 * is a hard requirement rather than an optimisation, for the same reason it is
 * on the `multi-select` rules: it is what makes the rule safe on a PARTIAL
 * update. A row that already holds more links than a cap later added to the
 * column allows must stay editable through its other columns, or lowering a cap
 * turns every historical row into a hard outage.
 */
export const findRelationshipLinkOverflows = (
  tableFields: readonly FieldDeclaration[],
  values: Readonly<Record<string, unknown>>
): readonly RelationshipLinkOverflow[] =>
  tableFields.flatMap((field) => {
    if (field.type !== 'relationship' || !(field.name in values)) return []
    if (!('maxLinked' in field) || typeof field.maxLinked !== 'number') return []
    const { maxLinked } = field
    const linked = linkedCount(values[field.name])
    return linked > maxLinked ? [{ field: field.name, maxLinked, linked }] : []
  })
