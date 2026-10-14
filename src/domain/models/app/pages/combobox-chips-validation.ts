/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `combobox.chips` without `multiple: true` — refused.
 *
 * Chips draw a SET of choices inside the field. A combobox that holds one value
 * has no set to draw, so an author writing `chips` alone would get a
 * single-choice type-ahead with the key silently dropped: the failure the
 * sibling select validators already refuse. The message names both keys.
 *
 * The walk is the loose-typed recursion its siblings use, so it finds a
 * `combobox` wherever one is nested — a page's `components[]`, a container's
 * `children[]`, or inside a `form`.
 */

/** Minimal shape needed to validate chip declarations. */
interface AppForComboboxChipsValidation {
  readonly pages?: unknown
}

/** The authored `props.id` of a component node, when it declares one. */
const authoredId = (record: Readonly<Record<string, unknown>>): string | undefined => {
  const { props } = record
  if (props === null || typeof props !== 'object') return undefined
  const { id } = props as Record<string, unknown>
  return typeof id === 'string' ? id : undefined
}

const chipsWithoutMultiple = (record: Readonly<Record<string, unknown>>): boolean =>
  record['type'] === 'combobox' && record['chips'] === true && record['multiple'] !== true

/** Every `combobox` declaring `chips` without `multiple`, by authored id (undefined when none). */
const collectOffenders = (node: unknown): readonly (string | undefined)[] => {
  if (Array.isArray(node)) return node.flatMap(collectOffenders)
  if (node === null || typeof node !== 'object') return []
  const record = node as Record<string, unknown>
  const nested = Object.values(record).flatMap(collectOffenders)
  return chipsWithoutMultiple(record) ? [authoredId(record), ...nested] : nested
}

/**
 * Validate every `combobox` declaring `chips`.
 *
 * Returns `true` when each one also declares `multiple: true`, or an error
 * message naming the first that does not.
 */
export const validateAllComboboxChips = (app: AppForComboboxChipsValidation): string | true => {
  if (!app.pages) return true
  const found = collectOffenders(app.pages)
  if (found.length === 0) return true
  const [id] = found
  const subject = id === undefined ? 'A combobox' : `Combobox '${id}'`
  return `${subject} declares \`chips\` without \`multiple: true\` — chips draw a set of choices, and a combobox holding one value has no set to draw. Add \`multiple: true\`, or drop \`chips\`.`
}
