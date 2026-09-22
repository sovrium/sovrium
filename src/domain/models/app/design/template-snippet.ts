/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One `components[]` TEMPLATE, serialised as the config an author wrote.
 *
 * ─── WHY THIS IS NOT `specimenSnippet`, AND IS NOT A COPY OF IT ────────────
 *
 * They serialise different things and one of them cannot serve the other.
 *
 * `specimenSnippet` (`domain/models/app/design/specimen-snippet.ts`)
 * prints a SPECIMEN, and deliberately omits `type` and `children` at the root:
 * it emits the type itself as its first line, and the children are the drawn
 * control shown directly above the block. Repeating them would print the
 * picture twice.
 *
 * A TEMPLATE's children ARE its declaration. `site-header` is a container whose
 * whole content is one `children` entry, so the specimen serialiser applied to
 * it produces a block naming the template and showing none of it — config that
 * copies to something the author never wrote. Measured on the console fixture:
 * the wordmark, which is the only content the template has, is dropped.
 *
 * ─── AND THE FOLLOW-UP THIS LEAVES, NAMED RATHER THAN HIDDEN ───────────────
 *
 * The two walks differ in exactly one respect — which keys are skipped at the
 * root — so they should end as one walk taking that set as a parameter.
 *
 * The reason they were not merged has now GONE. This note used to say the
 * specimen serialiser lived under `dashboard-surfaces/` and that merging across
 * a tree being deleted would be a conflict for no gain. That deletion has
 * happened: the serialiser is `specimenSnippet` in
 * `@/domain/models/app/design/specimen-snippet`, one directory away from
 * this file, and the merge is now what that note predicted — a rename and a
 * parameter. It is left undone rather than hidden, so the next reader inherits
 * the work and not a stale excuse for it.
 *
 * Until then the difference is stated in both directions rather than left for a
 * reader to infer from two similar functions.
 */

/** A value that serialises to one line. */
const isScalar = (value: unknown): value is string | number | boolean =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'

/** One indent level of the emitted block. */
const INDENT = '  '

/**
 * Serialise a value as the YAML an author would have written.
 *
 * Hand-rolled rather than routed through a YAML serialiser for the reason its
 * sibling gives: this is a READING surface, and the output has to stay a short,
 * quotation-free block that looks like the config file. A general serialiser
 * emits correct YAML with quoting and anchors a reader then has to decode.
 */
const serialise = (value: unknown, depth: number): readonly string[] => {
  const pad = INDENT.repeat(depth)

  if (isScalar(value)) return [`${pad}${String(value)}`]

  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (isScalar(entry)) return [`${pad}- ${String(entry)}`]
      const [first, ...rest] = serialise(entry, depth + 1)
      // The first line of an object entry carries the `- ` marker, so the entry
      // reads as one item rather than a bullet followed by a stray block.
      return first === undefined ? [] : [`${pad}- ${first.trimStart()}`, ...rest]
    })
  }

  if (typeof value !== 'object' || value === null) return []

  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
    if (isScalar(entry)) return [`${pad}${key}: ${String(entry)}`]
    const nested = serialise(entry, depth + 1)
    return nested.length === 0 ? [] : [`${pad}${key}:`, ...nested]
  })
}

/**
 * The template's own declaration, verbatim, as a copyable block.
 *
 * Nothing is omitted and nothing is added: the block is what the operator has
 * in their config file, which is the only thing worth offering to copy.
 */
export const templateSnippet = (template: unknown): string => serialise(template, 0).join('\n')

/**
 * How many nodes a template's component tree holds, `children` included.
 *
 * The measurement behind {@link isHeavyTemplate}. Separate from the verdict so
 * the threshold is one readable comparison rather than a number buried in a
 * walk.
 */
const nodeCount = (value: unknown): number => {
  if (Array.isArray(value)) return value.reduce<number>((sum, e) => sum + nodeCount(e), 0)
  if (typeof value !== 'object' || value === null) return 0
  const { children } = value as { readonly children?: unknown }
  return 1 + (children === undefined ? 0 : nodeCount(children))
}

/**
 * How many nodes a template may hold before a card collapses it.
 *
 * ─── A STATED THRESHOLD, NOT A HIDDEN ONE ─────────────────────────────────
 *
 * A page drawing every template at full height puts the fourth below three
 * screenfuls of the first three, and a footer's own specimen is taller than the
 * viewport — so SOMETHING has to decide, and a config page has neither
 * arithmetic nor recursion to decide it with. The verdict is therefore
 * published; publishing it with the number that produced it is what keeps it
 * reviewable rather than magic.
 *
 * Three is the smallest threshold that separates the two shapes the console
 * actually has: a header or a badge is a container with one or two children, a
 * trust band or a footer is a container with three or more. It is deliberately
 * a NODE count and not a pixel height, because pixels are not knowable
 * server-side and a height guessed from a tree would be a guess presented as a
 * measurement.
 */
const HEAVY_NODE_THRESHOLD = 4

/** Whether a template is too tall to draw inline. See {@link HEAVY_NODE_THRESHOLD}. */
export const isHeavyTemplate = (template: unknown): boolean =>
  nodeCount(template) >= HEAVY_NODE_THRESHOLD
