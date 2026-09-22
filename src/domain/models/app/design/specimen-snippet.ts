/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A drawn specimen, serialised — the config an author writes to get it.
 *
 * A drawn control answers "what does it look like". It does not answer the
 * question an author actually arrives with, which is "what do I write to get
 * that" — and an agent reading the catalogue to build the rest of an app needs
 * the second answer, not the first.
 *
 * ─── THE SNIPPET IS READ OFF THE SPECIMEN, NEVER WRITTEN BESIDE IT ─────────
 *
 * A config block hand-written next to a specimen is documentation that can
 * drift, and it drifts SILENTLY: nothing renders it, so nothing disagrees when
 * the specimen's props change. Both the snippet and the machine-readable
 * `drawnProps` are therefore projections of ONE object — the specimen's own
 * `component` definition — so they cannot disagree with the thing drawn above
 * them or with each other. `[internal ref]` asserts exactly that:
 * every prop the specimen was drawn with must appear in the snippet.
 *
 * ─── WHY IT IS A DOMAIN SERVICE AND NOT A PAGE BUILDER'S HELPER ────────────
 *
 * It lived beside the console page that printed it, in that page's own BUILDER.
 * The page is config now, and the serialisation reaches its reader as a
 * published FIELD of the component-type detail — so the caller is an endpoint
 * rather than a page, and a page BUILDER is not a place an endpoint can import
 * from. The anatomy-panel markup the module also held went with the builder;
 * only the projection survives, which is the half that was never about a page.
 *
 * It sits beside {@link ./template-snippet} rather than inside it: that one
 * serialises an OPERATOR's declared template and this one a catalogue specimen,
 * and their omission rules differ — a specimen omits the illustrative
 * `children` a template's reader needs.
 */

import type { Component } from '@/domain/models/app/pages/components'

type Scalar = string | number | boolean

/** Whether a config value is a leaf rather than a structure to walk into. */
const isScalar = (value: unknown): value is Scalar =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'

/**
 * Keys excluded from the snippet and the prop map.
 *
 * `type` is asserted separately and printed as the snippet's first line.
 * `children` is the specimen's illustrative filling — `layoutChildren` invents
 * cards reading "One" and "Two" so a container has any shape at all — and
 * printing them would document the illustration rather than the component.
 */
const OMITTED_KEYS: ReadonlySet<string> = new Set(['type', 'children'])

/** One indent level of the emitted config block. */
const INDENT = '  '

/**
 * The component definition, as the YAML an author would write.
 *
 * Deliberately hand-rolled rather than routed through a YAML serialiser: this
 * is a READING surface, and the output has to stay a short, quotation-free
 * block that looks like the config file. A general serialiser would emit
 * correct YAML with quoting and anchors that a reader has to decode.
 */
const serialise = (value: unknown, depth: number): readonly string[] => {
  const pad = INDENT.repeat(depth)

  if (isScalar(value)) return [`${pad}${String(value)}`]

  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (isScalar(entry)) return [`${pad}- ${String(entry)}`]
      const [first, ...rest] = serialise(entry, depth + 1)
      // The first line of an object entry carries the `- ` marker, so the entry
      // reads as one item rather than as a bullet followed by a stray block.
      return first === undefined ? [] : [`${pad}- ${first.trimStart()}`, ...rest]
    })
  }

  if (typeof value !== 'object' || value === null) return []

  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
    if (OMITTED_KEYS.has(key) && depth === 0) return []
    if (isScalar(entry)) return [`${pad}${key}: ${String(entry)}`]
    const nested = serialise(entry, depth + 1)
    return nested.length === 0 ? [] : [`${pad}${key}:`, ...nested]
  })
}

/**
 * Every scalar prop the specimen was drawn with, flattened by leaf name.
 *
 * The machine-readable half of the anti-drift pairing: a spec reads this
 * attribute and asserts each entry appears in the snippet, so the two
 * projections of the one definition are checked against each other on every
 * run rather than by anyone remembering to look.
 *
 * FLATTENED by leaf key rather than by path, because the assertion it feeds is
 * "the snippet mentions this prop", and the snippet prints leaf keys. A
 * collision keeps the last occurrence — sufficient, since the check is
 * containment and every occurrence is printed.
 */
const drawnProps = (value: unknown, depth: number): Readonly<Record<string, Scalar>> => {
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value.flatMap((entry) => Object.entries(drawnProps(entry, depth + 1)))
    )
  }
  if (typeof value !== 'object' || value === null) return {}

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
      if (OMITTED_KEYS.has(key) && depth === 0) return []
      if (isScalar(entry)) return [[key, entry] as const]
      return Object.entries(drawnProps(entry, depth + 1))
    })
  )
}

/**
 * The config snippet that produces one specimen.
 *
 * Printed by the component-type detail's `snippet` field, which is what the
 * console's Config block renders — and what a copy affordance hands a reader.
 */
export const specimenSnippet = (type: string, component: Component): string =>
  [`type: ${type}`, ...serialise(component, 0)].join('\n')

/**
 * The scalar props a component was drawn with, serialised.
 *
 * The COMPONENT-shaped counterpart of {@link specimenSnippet}, so a caller
 * holding a bare `Component` spends the same walker rather than growing a
 * second one. That symmetry is the whole guarantee: the two are projections of
 * ONE definition, and a second walker beside the first is exactly the drift the
 * pairing exists to prevent.
 */
export const drawnPropsOf = (component: Component): string =>
  JSON.stringify(drawnProps(component, 0))
