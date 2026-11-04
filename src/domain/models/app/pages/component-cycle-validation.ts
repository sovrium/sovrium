/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { collectPlacements } from './component-reference-validation'

/**
 * A component template may place other templates, and none of them may lead
 * back to it: a template that reaches itself through placements, directly
 * (`tree-node` placing `tree-node`) or through others (`menu` placing
 * `submenu` placing `menu`), has no finite drawing.
 *
 * The renderer would stop expanding at the repeat and leave a template
 * reference where the drawing should be, with nothing on the page saying why,
 * so the cycle is refused when the app is read (boot and `sovrium validate`),
 * naming every template on it in order. It needs every template at once, so it
 * is a rule over `app.components` rather than a check on one field.
 *
 * Placements are read by the walk the unknown-name rule reads them with
 * (`collectPlacements`), in both forms, at any depth of a template's body. A
 * placement naming no template is that rule's to refuse. Pure: no I/O.
 */

/** Minimal shape needed to look for cycles. */
interface AppForCycleValidation {
  readonly components?: unknown
}

/** Each declared template's name and the templates its body places, in order. */
const placementGraph = (components: unknown): ReadonlyMap<string, readonly string[]> =>
  new Map(
    (Array.isArray(components) ? components : []).flatMap((template: unknown) =>
      isRecord(template) && typeof template['name'] === 'string'
        ? [
            [
              template['name'],
              [...new Set(collectPlacements(template).map((placement) => placement.name))],
            ] as const,
          ]
        : []
    )
  )

/**
 * The shortest chain of placements from `start` back to itself, `start`
 * first and last, or `undefined` when none leads back. Breadth-first, so the
 * chain named is the one an author reads first.
 */
const cycleFrom = (
  start: string,
  graph: ReadonlyMap<string, readonly string[]>
): readonly string[] | undefined => {
  const step = (
    frontier: readonly (readonly string[])[],
    seen: ReadonlySet<string>
  ): readonly string[] | undefined => {
    if (frontier.length === 0) return undefined
    const next = frontier.flatMap((chain) =>
      (graph.get(chain.at(-1) ?? '') ?? []).map((name) => [...chain, name])
    )
    const closed = next.find((chain) => chain.at(-1) === start)
    if (closed !== undefined) return closed
    const fresh = next.filter((chain) => {
      const last = chain.at(-1) ?? ''
      return graph.has(last) && !seen.has(last)
    })
    const unique = fresh.filter(
      (chain, index) => fresh.findIndex((other) => other.at(-1) === chain.at(-1)) === index
    )
    return step(unique, new Set([...seen, ...unique.map((chain) => chain.at(-1) ?? '')]))
  }
  return step([[start]], new Set([start]))
}

/**
 * Refuse a template that places itself, directly or through other templates.
 *
 * @returns `true` when no template reaches itself, or the message naming the
 * first template, in declaration order, that does, and the chain in order.
 */
export const validateTemplateCycles = (app: AppForCycleValidation): string | true => {
  const graph = placementGraph(app.components)
  const cycle = [...graph.keys()]
    .map((name) => cycleFrom(name, graph))
    .find((chain) => chain !== undefined)
  if (cycle === undefined) return true
  return (
    `Template "${cycle[0] ?? ''}" places itself: ${cycle.join(' → ')}. ` +
    `A template may place other templates, but no chain of placements may lead back to one ` +
    `already being drawn, or it never ends. Remove one placement on that chain.`
  )
}
