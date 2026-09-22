/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `select.emptyOption` coherence cross-validation.
 *
 * `emptyOption` offers the UNSET choice as the control's first option, and it
 * submits the empty string. Two of the component's other keys describe a
 * control that cannot mean that, and both fail SILENTLY if allowed through:
 *
 *  1. `multiple: true`. A multi-select already expresses "none" by selecting
 *     nothing. An option whose value is `''` becomes a MEMBER of the selection
 *     instead — so picking "All" alongside two real values submits
 *     `',failed,succeeded'`, and picking it alone submits a selection of one
 *     empty string rather than an empty selection. That is not a degraded
 *     "All"; it is a different answer wearing its label.
 *
 *  2. A static `options` entry that already submits the empty string. Two rows
 *     with one value is a control whose selected choice cannot be read back —
 *     the browser reports `''` and nothing says which line the reader clicked.
 *     This is the shape an author reaches for first, because writing the row by
 *     hand is exactly what `emptyOption` replaces on a statically-authored list.
 *
 * Both are refused rather than degraded, for the reason `select-native-validation`
 * records beside it: a key this control cannot honour disappears in silence, and
 * this component has already paid for that once.
 *
 * WHERE THIS LIVES, AND WHY NOT IN THE COMPONENT SCHEMA. `buildComponentUnion`
 * composes every branch mechanically from a `[literal, fields]` tuple and has no
 * per-branch refinement hook, so a cross-field rule cannot be stated on the
 * `select` struct itself. The caller folds this into the EXISTING
 * `validateSelectDeclarations` grouping rather than adding a link to the final
 * filter chain — each extra link pushes TypeScript's inference depth toward the
 * point where the derived `App` type collapses to `never`, and the filter is
 * measurably at its complexity budget already.
 *
 * The walk is intentionally loose-typed (`unknown`) and recurses through every
 * value, so it finds a `select` wherever it is nested — a page's top-level
 * `components[]`, a container's `children[]`, or inside a `form`'s children.
 */

/** Minimal shape needed to validate `emptyOption` declarations. */
interface AppForEmptyOptionValidation {
  readonly pages?: unknown
}

/** One `select` declaring `emptyOption`, reduced to the keys that contradict it. */
interface FoundEmptyOptionSelect {
  /** The authored `props.id`, when there is one — named in the message. */
  readonly id: string | undefined
  readonly multiple: boolean
  /** The label of the first static option that already submits `''`, if any. */
  readonly collidingOption: string | undefined
}

const isEmptyOptionSelect = (record: Readonly<Record<string, unknown>>): boolean => {
  if (record['type'] !== 'select') return false
  const declaration = record['emptyOption']
  return declaration !== null && typeof declaration === 'object'
}

/** The authored `props.id` of a component node, when it declares one. */
const authoredId = (record: Readonly<Record<string, unknown>>): string | undefined => {
  const { props } = record
  if (props === null || typeof props !== 'object') return undefined
  const { id } = props as Record<string, unknown>
  return typeof id === 'string' ? id : undefined
}

/**
 * The label of the first STATIC option already submitting the empty string.
 *
 * Only the static array is inspected. Options resolved from a `dataSource` are
 * projected from row values, and a row whose value is nullish is dropped rather
 * than rendered — so a resolved list cannot contain an empty value to collide
 * with.
 */
const firstEmptyValuedOption = (options: unknown): string | undefined => {
  if (!Array.isArray(options)) return undefined
  const colliding = options.find(
    (option) =>
      option !== null &&
      typeof option === 'object' &&
      (option as Record<string, unknown>)['value'] === ''
  )
  if (colliding === undefined) return undefined
  const { label } = colliding as Record<string, unknown>
  return typeof label === 'string' ? label : '(unlabelled)'
}

/** Recursively collect every `select` declaring an `emptyOption`. */
const collectEmptyOptionSelects = (node: unknown): readonly FoundEmptyOptionSelect[] => {
  if (Array.isArray(node)) return node.flatMap(collectEmptyOptionSelects)
  if (node === null || typeof node !== 'object') return []

  const record = node as Record<string, unknown>
  const nested = Object.values(record).flatMap(collectEmptyOptionSelects)
  if (!isEmptyOptionSelect(record)) return nested

  return [
    {
      id: authoredId(record),
      multiple: record['multiple'] === true,
      collidingOption: firstEmptyValuedOption(record['options']),
    },
    ...nested,
  ]
}

/** How a message names the offending control. */
const subject = (found: FoundEmptyOptionSelect): string =>
  found.id === undefined ? 'A select' : `Select '${found.id}'`

/** Validate ONE declaration; returns an error message, or `undefined`. */
const validateEmptyOptionSelect = (found: FoundEmptyOptionSelect): string | undefined => {
  if (found.multiple) {
    return `${subject(found)} declares both 'emptyOption' and 'multiple: true' — a multi-select expresses "none" by selecting nothing, so an option submitting the empty string would join the selection rather than clear it. Remove one.`
  }
  if (found.collidingOption !== undefined) {
    return `${subject(found)} declares 'emptyOption' and a static option ('${found.collidingOption}') that already submits the empty string — two choices with one value cannot be told apart when the selection is read back. Remove one.`
  }
  return undefined
}

/**
 * Validate every `select` declaring an `emptyOption`.
 *
 * Returns `true` when all of them are coherent, or an error message string
 * naming the first offending control.
 */
export const validateAllSelectEmptyOptions = (app: AppForEmptyOptionValidation): string | true => {
  if (!app.pages) return true

  const found = collectEmptyOptionSelects(app.pages)
  if (found.length === 0) return true

  return found.map(validateEmptyOptionSelect).find((error) => error !== undefined) ?? true
}
