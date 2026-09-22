/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `select.native` coherence cross-validation.
 *
 * `native: true` asks for the browser's own control. Three of the component's
 * other keys describe things that control cannot do, and each of them fails
 * SILENTLY if allowed through — the page boots, the control renders, and the
 * key is simply not there:
 *
 *  1. `searchable` grows a type-ahead field inside the option list. The
 *     platform control has no such field to grow.
 *  2. `allowCustomValue` accepts a typed value that matches no option. Its own
 *     schema description already says "when `searchable: true`", so on a
 *     platform control it is doubly unreachable.
 *  3. A per-option `icon` paints a glyph beside the label. An `option` element
 *     renders text, and nothing else — which is why `renderSsrSelectOptions`
 *     already drops the icon in the pre-hydration skeleton.
 *
 * All three are refused rather than degraded, because a dropped key is the
 * failure this component has already paid for once: the top-level
 * `valueField` / `displayField` pair was declared, documented, read by nothing,
 * and removed only after four specs had asserted around it. A config that
 * cannot be honoured is a config that should not decode.
 *
 * WHERE THIS LIVES, AND WHY NOT IN THE COMPONENT SCHEMA. `buildComponentUnion`
 * composes every branch mechanically from a `[literal, fields]` tuple and has
 * no per-branch refinement hook, so a cross-field rule cannot be stated on the
 * `select` struct itself. The caller BUNDLES this into the existing final
 * `Schema.filter` rather than adding a new link to the chain — each extra link
 * pushes TypeScript's inference depth toward the point where the derived `App`
 * type collapses to `never`, which fails silently at every consumer.
 *
 * The walk is intentionally loose-typed (`unknown`) and recurses through every
 * value, so it finds a `select` wherever it is nested — a page's top-level
 * `components[]`, a container's `children[]`, or inside a `form`'s children,
 * which is where the published docs put form controls in the first place.
 */

/** Minimal shape needed to validate native-select declarations. */
interface AppForNativeSelectValidation {
  readonly pages?: unknown
}

/** One `native: true` select, reduced to the keys that can contradict it. */
interface FoundNativeSelect {
  /** The authored `props.id`, when there is one — named in the message. */
  readonly id: string | undefined
  readonly searchable: boolean
  readonly allowCustomValue: boolean
  /** The first static option carrying an `icon`, when any does. */
  readonly iconOption: string | undefined
}

const isNativeSelectNode = (record: Readonly<Record<string, unknown>>): boolean =>
  record['type'] === 'select' && record['native'] === true

/** The authored `props.id` of a component node, when it declares one. */
const authoredId = (record: Readonly<Record<string, unknown>>): string | undefined => {
  const { props } = record
  if (props === null || typeof props !== 'object') return undefined
  const { id } = props as Record<string, unknown>
  return typeof id === 'string' ? id : undefined
}

/**
 * The label of the first static option declaring an `icon`.
 *
 * Only the STATIC `options` array is inspected. Options resolved from a
 * `dataSource` are projected from row values by `valueKey` / `labelKey` and
 * never carry an icon, so there is nothing there to lose.
 */
const firstIconOption = (options: unknown): string | undefined => {
  if (!Array.isArray(options)) return undefined
  const withIcon = options.find(
    (option) =>
      option !== null &&
      typeof option === 'object' &&
      typeof (option as Record<string, unknown>)['icon'] === 'string'
  )
  if (withIcon === undefined) return undefined
  const { label } = withIcon as Record<string, unknown>
  return typeof label === 'string' ? label : '(unlabelled)'
}

/** Recursively collect every `select` declaring `native: true`. */
const collectNativeSelects = (node: unknown): readonly FoundNativeSelect[] => {
  if (Array.isArray(node)) return node.flatMap(collectNativeSelects)
  if (node === null || typeof node !== 'object') return []

  const record = node as Record<string, unknown>
  const nested = Object.values(record).flatMap(collectNativeSelects)
  if (!isNativeSelectNode(record)) return nested

  return [
    {
      id: authoredId(record),
      searchable: record['searchable'] === true,
      allowCustomValue: record['allowCustomValue'] === true,
      iconOption: firstIconOption(record['options']),
    },
    ...nested,
  ]
}

/** How a message names the offending control. */
const subject = (found: FoundNativeSelect): string =>
  found.id === undefined ? 'A select' : `Select '${found.id}'`

/** Validate ONE native select; returns an error message, or `undefined`. */
const validateNativeSelect = (found: FoundNativeSelect): string | undefined => {
  if (found.searchable) {
    return `${subject(found)} declares both 'native: true' and 'searchable: true' — the browser's own select has no type-ahead field, so the two name different controls. Remove one.`
  }
  if (found.allowCustomValue) {
    return `${subject(found)} declares both 'native: true' and 'allowCustomValue: true' — the browser's own select offers only its declared options, so a custom value can never be entered. Remove one.`
  }
  if (found.iconOption !== undefined) {
    return `${subject(found)} declares 'native: true' and an option ('${found.iconOption}') carrying an 'icon' — an option element renders text only, so the icon would silently not appear. Remove one.`
  }
  return undefined
}

/**
 * Validate every `select` declaring `native: true`.
 *
 * Returns `true` when all of them are coherent, or an error message string
 * naming the first offending control.
 */
export const validateAllNativeSelects = (app: AppForNativeSelectValidation): string | true => {
  if (!app.pages) return true

  const found = collectNativeSelects(app.pages)
  if (found.length === 0) return true

  return found.map(validateNativeSelect).find((error) => error !== undefined) ?? true
}
