/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Repeated-shape hoisting for the config-type declaration `build-types.ts`
 * emits: pure text transforms over the printer's one-line output, with no
 * compiler API in sight. Split out of `build-types.ts` so the emitter stays one
 * job, the same way `config-types-self-containment.ts` holds the inlining.
 */

import { escapeRegExp } from '@/domain/kernel/sanitize/escape-regexp'

/**
 * WHY THE EMITTER HOISTS A SHAPE INSTEAD OF LETTING TYPESCRIPT NAME IT
 * --------------------------------------------------------------------
 * `checker.typeToString` DOES print a type by name — but only when the printed
 * `ts.Type` carries an `aliasSymbol`, which happens when the type reached the
 * printer through a source-level type REFERENCE. Nothing under `AppConfig` does:
 * every property below the top level is computed by Effect Schema's mapped
 * `Schema.Schema.Type<…>` extraction, which yields fresh anonymous object types.
 * So the printer expands them structurally, once per occurrence.
 *
 * That is normally invisible. It stopped being invisible when `design.components`
 * became a closed `Schema.Struct` over the 85 engine component types, each
 * `Schema.optional(ComponentStyleSchema)`: ONE shape, printed 170 times (85 keys
 * x `AppConfig` and `DesignConfig`), which more than doubled the declaration the
 * binary embeds and `sovrium types` writes. The published JSON Schema does not
 * pay this — it emits `ComponentStyle` once behind a `$ref`.
 *
 * Three routes were considered:
 *
 *   1. Give the schema a nominal anchor — a hand-written `interface ComponentStyle`
 *      the schema const is annotated with. That WOULD make the printer name it
 *      everywhere, but it duplicates the shape by hand in the domain model, which
 *      is a drift source with no gate on it. Rejected.
 *   2. Print the shape independently and substitute it. Rejected because it does
 *      not work: the printer's MEMBER ORDER is context-dependent. Printing the
 *      same `ComponentStyle` from the `DesignComponents` alias yields `parts`
 *      first, from `DesignConfig['components']` yields `replace` first, and the
 *      `states` members reorder too — measured, and the reason this code mines the
 *      canonical text out of its OWN output rather than re-deriving it.
 *   3. Hoist the emitted bytes. What this does.
 *
 * The hoist is text-level but not blind: the key list is derived from the checker,
 * the canonical block is taken from the emitted text, and the result is asserted
 * key by key (`assertEveryKeyHoisted`). A shape that is not uniform across the 85
 * keys fails the build rather than half-collapsing.
 */

/**
 * Collapse every run of 2+ spaces to one.
 *
 * The printer emits each type on ONE line and expresses nesting purely as runs
 * of spaces, so this is exactly "ignore the depth this shape happens to sit at".
 * Single spaces are token separators and are preserved.
 */
export const normalizePrintedIndentation = (text: string): string => text.replace(/ {2,}/g, ' ')

/**
 * The balanced `{ … }` block immediately following `marker`, or `undefined` when
 * the marker is absent or is not followed by an object type.
 */
export const readPrintedTypeBlock = (text: string, marker: string): string | undefined => {
  const at = text.indexOf(marker)
  if (at === -1) return undefined

  const open = at + marker.length
  if (text[open] !== '{') return undefined

  let depth = 0
  for (let i = open; i < text.length; i += 1) {
    const char = text[i]
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return text.slice(open, i + 1)
    }
  }
  return undefined
}

/**
 * Re-indent a block captured at some nesting depth so it reads as a top-level
 * type alias body.
 *
 * The run immediately before the block's own closing brace IS its nesting
 * depth, so subtracting that run's width from every run puts the block at
 * column zero. One space is always kept, because the printer's runs double as
 * token separators.
 */
export const dedentPrintedType = (block: string): string => {
  const outdent = / +(?=\}$)/.exec(block)?.[0]?.length ?? 0
  return outdent === 0
    ? block
    : block.replace(/ {2,}/g, (run) => ' '.repeat(Math.max(1, run.length - outdent)))
}

/**
 * A matcher for `block` that tolerates the indentation depth it is printed at.
 *
 * Every run of 2+ spaces becomes ` {2,}`; everything else is matched literally.
 * Loosening only the indentation is what makes one canonical block match the
 * same shape wherever it appears — the two live depths differ by 4 spaces per
 * run — without ever matching a genuinely different type.
 */
export const printedTypeOccurrenceMatcher = (block: string): RegExp => {
  const pattern = block.split(/ {2,}/).map(escapeRegExp).join(' {2,}')
  // Every segment goes through the canonical `escapeRegExp`; the only unescaped
  // text is the ` {2,}` this function writes itself. The rule cannot see that,
  // because the escaping is not the OUTERMOST expression — it sits under a
  // `.map(…).join(…)`. Backtracking is bounded too: each ` {2,}` is followed by
  // a literal non-space character, so the quantifiers cannot overlap.
  // eslint-disable-next-line sovrium/no-dynamic-regexp -- fully escaped above, not an injection sink
  return new RegExp(pattern, 'g')
}

/** The two spellings a printed optional property key can take. */
const optionalKeyMarkers = (key: string): readonly string[] => [
  `readonly ${key}?: `,
  `readonly "${key}"?: `,
]

export interface HoistResult {
  /** The rewritten type strings, in the order they were given. */
  readonly texts: readonly string[]
  /** The hoisted shape, re-indented for a top-level alias. */
  readonly body: string
  readonly replacements: number
  readonly bytesSaved: number
}

/**
 * Replace every printed occurrence of one repeated shape with a reference to
 * `name`, and return the shape so the caller can declare it once.
 *
 * `propertyKeys` is both the anchor (the first key whose value is an object type
 * supplies the canonical bytes) and the proof: after rewriting, EVERY key must
 * name `name`. A key left expanded means the keys do not in fact share one
 * shape, which invalidates the single hoisted alias — so it throws rather than
 * shipping a declaration where 84 keys are named and one silently is not.
 *
 * Throws when the anchor cannot be found or fewer than two occurrences were
 * replaced; the caller decides whether the feature is present at all.
 */
export const hoistPrintedType = (
  texts: readonly string[],
  propertyKeys: readonly string[],
  name: string
): HoistResult => {
  const anchor = propertyKeys
    .flatMap((key) => optionalKeyMarkers(key))
    .flatMap((marker) => texts.flatMap((text) => readPrintedTypeBlock(text, marker) ?? []))
    .at(0)

  if (anchor === undefined) {
    throw new Error(
      `Cannot hoist '${name}': no object type follows any of the ${propertyKeys.length} keys`
    )
  }

  const matcher = printedTypeOccurrenceMatcher(anchor)
  let replacements = 0
  let bytesSaved = 0
  const rewritten = texts.map((text) =>
    text.replace(matcher, (match) => {
      replacements += 1
      bytesSaved += match.length - name.length
      return name
    })
  )

  if (replacements < 2) {
    throw new Error(
      `Cannot hoist '${name}': only ${replacements} occurrence(s) — a named alias would cost bytes rather than save them`
    )
  }

  const notHoisted = propertyKeys.filter(
    (key) =>
      !rewritten.some((text) =>
        optionalKeyMarkers(key).some((marker) => text.includes(`${marker}${name}`))
      )
  )
  if (notHoisted.length > 0) {
    throw new Error(
      `Cannot hoist '${name}': ${notHoisted.length} of ${propertyKeys.length} keys print a DIFFERENT shape ` +
        `(${notHoisted.slice(0, 5).join(', ')}${notHoisted.length > 5 ? ', …' : ''}). ` +
        'The keys no longer share one type, so one alias cannot stand for all of them.'
    )
  }

  return { texts: rewritten, body: dedentPrintedType(anchor), replacements, bytesSaved }
}
