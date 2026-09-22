/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `select.multiple` beside `select.searchable` — refused.
 *
 * The two keys name two different controls. A searchable select is a combobox:
 * the closed control is a text input the reader types into, and the typing IS
 * the field. A multiple select answers with a set, and the only place a
 * combobox has to show a set is inside that same input, as chips — which
 * nothing in the engine builds. So an author who writes both gets a
 * single-choice type-ahead, their `multiple` dropped, and no word about it.
 *
 * That is the exact failure `select-native-validation.ts` already exists to
 * refuse, and this is the same judgement applied to a fourth pair:
 *
 *   _"A config that cannot be honoured is a config that should not decode."_
 *
 * A docs footnote was the alternative and was rejected: it leaves the declared
 * key dropped at runtime and asks the author to have read the right paragraph.
 * The refusal names both keys at boot instead.
 *
 * ─── AND IT FORECLOSES NOTHING ─────────────────────────────────────────────
 *
 * Multiple selection through a combobox is a real control; it is simply one
 * Sovrium does not draw yet. The day it ships, this rule is deleted and the
 * combination starts meaning what its author meant.
 *
 * The walk is the loose-typed recursion its sibling validators use, so it finds
 * a `select` wherever one is nested — a page's `components[]`, a container's
 * `children[]`, or inside a `form`, which is where the published docs put form
 * controls in the first place.
 */

/** Minimal shape needed to validate multiple/searchable declarations. */
interface AppForMultipleSelectValidation {
  readonly pages?: unknown
}

/** One `select` declaring both keys, reduced to what a message needs. */
interface FoundMultipleSearchableSelect {
  /** The authored `props.id`, when there is one — named in the message. */
  readonly id: string | undefined
}

/** The authored `props.id` of a component node, when it declares one. */
const authoredId = (record: Readonly<Record<string, unknown>>): string | undefined => {
  const { props } = record
  if (props === null || typeof props !== 'object') return undefined
  const { id } = props as Record<string, unknown>
  return typeof id === 'string' ? id : undefined
}

const declaresBoth = (record: Readonly<Record<string, unknown>>): boolean =>
  record['type'] === 'select' && record['multiple'] === true && record['searchable'] === true

/** Recursively collect every `select` declaring both keys. */
const collectOffendingSelects = (node: unknown): readonly FoundMultipleSearchableSelect[] => {
  if (Array.isArray(node)) return node.flatMap(collectOffendingSelects)
  if (node === null || typeof node !== 'object') return []

  const record = node as Record<string, unknown>
  const nested = Object.values(record).flatMap(collectOffendingSelects)
  if (!declaresBoth(record)) return nested

  return [{ id: authoredId(record) }, ...nested]
}

/** How a message names the offending control. */
const subject = (found: FoundMultipleSearchableSelect): string =>
  found.id === undefined ? 'A select' : `Select '${found.id}'`

/**
 * Validate every `select` declaring `multiple` beside `searchable`.
 *
 * Returns `true` when none does, or an error message naming the first one.
 */
export const validateAllMultipleSearchableSelects = (
  app: AppForMultipleSelectValidation
): string | true => {
  if (!app.pages) return true

  const found = collectOffendingSelects(app.pages)
  const first = found[0]
  if (first === undefined) return true

  return `${subject(first)} declares both 'multiple: true' and 'searchable: true' — a searchable select is a text input the reader types into, and it has nowhere to show a set of choices, so one of the two would be silently dropped. Remove one.`
}
