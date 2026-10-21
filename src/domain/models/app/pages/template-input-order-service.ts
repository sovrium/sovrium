/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A template's structured input values, put in the order the page schema
 * writes their keys.
 *
 * A component written inline on a page is decoded at startup, and decoding
 * builds each object in the schema's own key order. A `json` input value is
 * inserted into its template as the placement wrote it, so an author who wrote
 * a column `{ label, field }` drew a placement whose markup differed from the
 * same tree written inline — by key order alone, in every island's serialised
 * props. Each value a placement passed whole is therefore replaced by the same
 * value as the decoded node holds it: a transparent placement is drawn exactly
 * as its inline tree, whatever order its values were written in.
 *
 * The expanded node is decoded as a page component, the very check
 * `template-input-validation.ts` makes of it at startup. A node that does not
 * decode is left as written: the startup check has refused it already, unless
 * its values are another template's `$tokens`, which are checked where that
 * template is placed.
 */

import { Schema } from 'effect'
import { ComponentSchema } from './components/component'
import type { InputDrawnAt, NodePointer } from './template-input-service'

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The keys a template carries about itself; they are never a placed field. */
const TEMPLATE_META_KEYS: ReadonlySet<string> = new Set(['name', 'render', 'inputs', 'guidance'])

const SLOT_MARKER = /^\$(?:children|slots\.[a-zA-Z][a-zA-Z0-9]*)$/

/**
 * An expanded template node as the page decodes it: its template keys dropped
 * and its slot markers empty, since the placement's own components fill them
 * after the inputs are drawn.
 */
export const asPageNode = (value: unknown, root = true): unknown => {
  if (Array.isArray(value)) return value.map((item: unknown) => asPageNode(item, false))
  if (!isRecord(value)) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !root || !TEMPLATE_META_KEYS.has(key))
      .map(([key, child]) =>
        key === 'children' && typeof child === 'string' && SLOT_MARKER.test(child)
          ? [key, []]
          : [key, asPageNode(child, false)]
      )
  )
}

/** The value at a pointer, or `undefined` when the path does not exist. */
const valueAt = (value: unknown, pointer: NodePointer): unknown =>
  pointer.reduce<unknown>((at, segment) => {
    if (Array.isArray(at) && typeof segment === 'number') return at[segment]
    return isRecord(at) && typeof segment === 'string' ? at[segment] : undefined
  }, value)

/** `value` with `replacement` at a pointer that exists in it. */
const withValueAt = (value: unknown, pointer: NodePointer, replacement: unknown): unknown => {
  const [segment, ...rest] = pointer
  if (segment === undefined) return replacement
  if (Array.isArray(value) && typeof segment === 'number') {
    return value.map((item: unknown, index) =>
      index === segment ? withValueAt(item, rest, replacement) : item
    )
  }
  if (isRecord(value) && typeof segment === 'string') {
    return { ...value, [segment]: withValueAt(value[segment], rest, replacement) }
  }
  return value
}

/**
 * The expanded node with every value an input filled whole in the schema's key
 * order.
 *
 * @param node - a template expanded for one placement (`expandTemplateInputs`)
 * @param drawn - where each input filled a whole field of it
 * @returns the node with each of those fields as the decoded node holds it;
 *   the same node when no input filled a field, or when the node does not decode
 */
export const withInputsInSchemaOrder = (
  node: Readonly<Record<string, unknown>>,
  drawn: readonly InputDrawnAt[]
): Readonly<Record<string, unknown>> => {
  if (drawn.length === 0) return node
  const decoded = Schema.decodeUnknownExit(ComponentSchema)(asPageNode(node), { errors: 'first' })
  if (decoded._tag !== 'Success') return node
  return drawn.reduce<Readonly<Record<string, unknown>>>((current, { pointer }) => {
    const ordered = valueAt(decoded.value, pointer)
    return ordered === undefined
      ? current
      : (withValueAt(current, pointer, ordered) as Readonly<Record<string, unknown>>)
  }, node)
}
