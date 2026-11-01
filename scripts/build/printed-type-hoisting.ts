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
 * key by key. A key that ends up neither named nor extending the name fails the
 * build rather than half-collapsing.
 *
 * THE KEYS ARE NOT ALL ONE SHAPE
 * ------------------------------
 * They were, until `design.components.text` took its own schema: every member of
 * `ComponentStyle` plus an `elements` map. So the keys now share one BASE shape,
 * and a key may extend it with members of its own. The hoist handles that in two
 * passes, with no key named in this file:
 *
 *   1. The canonical block is the shape the MOST keys print (not merely the first
 *      key's), and every exact occurrence of it becomes the name.
 *   2. A key whose block holds every canonical member verbatim, plus members of
 *      its own, prints as `ComponentStyle & { <its own members> }`. That
 *      intersection is exactly the superset — object members with distinct keys
 *      intersect to their union — and it keeps the declaration from carrying the
 *      base shape expanded a second time.
 *
 * Anything else — a key missing a canonical member, or printing one with a
 * different type — is still a DIFFERENT shape and still throws. The exemption is
 * derived (a strict superset of the canonical members), never a list of keys.
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

/**
 * The top-level members of a printed object block, each with its leading
 * indentation and its trailing `;`, plus the whitespace before the closing brace.
 *
 * Splits on `;` at the block's own depth only, so a nested object type stays
 * inside its member. Double-quoted string literal types are skipped over, so a
 * brace or a semicolon inside one cannot unbalance the scan. Returns `undefined`
 * for anything that is not a single balanced `{ … }` block.
 */
export const splitPrintedMembers = (
  block: string
): { readonly members: readonly string[]; readonly tail: string } | undefined => {
  if (!block.startsWith('{') || !block.endsWith('}')) return undefined

  const inner = block.slice(1, -1)
  const members: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < inner.length; i += 1) {
    switch (inner[i]) {
      case '"':
        i += 1
        while (i < inner.length && inner[i] !== '"') i += inner[i] === '\\' ? 2 : 1
        break
      case '{':
      case '(':
      case '[':
        depth += 1
        break
      case '}':
      case ')':
      case ']':
        depth -= 1
        if (depth < 0) return undefined
        break
      case ';':
        if (depth === 0) {
          members.push(inner.slice(start, i + 1))
          start = i + 1
        }
        break
      default:
        break
    }
  }

  const tail = inner.slice(start)
  if (depth !== 0 || tail.trim() !== '') return undefined
  return { members, tail }
}

/** A member compared without the indentation it happens to be printed at. */
const memberKey = (member: string): string => normalizePrintedIndentation(member).trim()

/**
 * `base & { <the members block has beyond canonical> }` when `block` holds every
 * canonical member verbatim plus at least one of its own; otherwise `undefined`.
 *
 * The extra members keep their printed bytes, so the result is indented like the
 * block it replaces.
 */
export const extendPrintedType = (
  block: string,
  canonical: string,
  name: string
): string | undefined => {
  const own = splitPrintedMembers(block)
  const base = splitPrintedMembers(canonical)
  if (own === undefined || base === undefined) return undefined

  const required = new Set(base.members.map(memberKey))
  const present = new Set(own.members.map(memberKey))
  if ([...required].some((member) => !present.has(member))) return undefined

  const extras = own.members.filter((member) => !required.has(memberKey(member)))
  if (extras.length === 0) return undefined
  return `${name} & {${extras.join('')}${own.tail}}`
}

/**
 * The block most keys print, as raw bytes. Each key votes with the first object
 * type found after it; ties go to the earliest key. Choosing by majority rather
 * than by the first key means a key that extends the base shape can sit anywhere
 * in the list without becoming the canonical block itself.
 */
const majorityBlock = (
  texts: readonly string[],
  propertyKeys: readonly string[]
): string | undefined => {
  const candidates = propertyKeys.flatMap((key) =>
    optionalKeyMarkers(key)
      .flatMap((marker) => texts.flatMap((text) => readPrintedTypeBlock(text, marker) ?? []))
      .slice(0, 1)
  )
  const votes = new Map<string, { readonly block: string; count: number }>()
  for (const block of candidates) {
    const key = normalizePrintedIndentation(block)
    const entry = votes.get(key)
    if (entry === undefined) votes.set(key, { block, count: 1 })
    else entry.count += 1
  }
  return [...votes.values()].reduce<{ readonly block: string; count: number } | undefined>(
    (best, entry) => (best === undefined || entry.count > best.count ? entry : best),
    undefined
  )?.block
}

export interface HoistResult {
  /** The rewritten type strings, in the order they were given. */
  readonly texts: readonly string[]
  /** The hoisted shape, re-indented for a top-level alias. */
  readonly body: string
  /** Exact occurrences of the shape replaced by the name. */
  readonly replacements: number
  /** Keys whose shape extends the name (`Name & { … }`) rather than equalling it. */
  readonly extendedKeys: readonly string[]
  readonly bytesSaved: number
}

/** Does `key` print as `name`, or as `name & { … }`, somewhere in `texts`? */
const keyNamesType = (texts: readonly string[], key: string, name: string): boolean =>
  texts.some((text) => optionalKeyMarkers(key).some((marker) => text.includes(`${marker}${name}`)))

/**
 * Replace every printed occurrence of one repeated shape with a reference to
 * `name`, and return the shape so the caller can declare it once.
 *
 * `propertyKeys` is both the anchor (the block the most keys print supplies the
 * canonical bytes) and the proof: after rewriting, EVERY key must name `name` —
 * exactly, or as `name & { … }` when its block is a strict superset of the
 * canonical members (see the module notes). A key left expanded means it does
 * not share the shape, which invalidates the alias — so it throws rather than
 * shipping a declaration where most keys are named and one silently is not.
 *
 * Throws when the anchor cannot be found or fewer than two occurrences were
 * replaced; the caller decides whether the feature is present at all.
 */
export const hoistPrintedType = (
  texts: readonly string[],
  propertyKeys: readonly string[],
  name: string
): HoistResult => {
  const anchor = majorityBlock(texts, propertyKeys)

  if (anchor === undefined) {
    throw new Error(
      `Cannot hoist '${name}': no object type follows any of the ${propertyKeys.length} keys`
    )
  }

  const matcher = printedTypeOccurrenceMatcher(anchor)
  let replacements = 0
  let bytesSaved = 0
  const named = texts.map((text) =>
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

  // Pass 2: a key not named exactly may still EXTEND the shape. Each of its
  // printed occurrences that is a strict superset becomes `name & { … }`.
  const extendedKeys: string[] = []
  const rewritten = propertyKeys
    .filter((key) => !keyNamesType(named, key, name))
    .reduce<readonly string[]>((current, key) => {
      let extended = false
      const next = current.map((text) =>
        optionalKeyMarkers(key).reduce((acc, marker) => {
          let out = ''
          let from = 0
          for (let at = acc.indexOf(marker); at !== -1; at = acc.indexOf(marker, from)) {
            const open = at + marker.length
            const block = readPrintedTypeBlock(acc.slice(at), marker)
            const replacement =
              block === undefined ? undefined : extendPrintedType(block, anchor, name)
            if (block === undefined || replacement === undefined) {
              out += acc.slice(from, open)
              from = open
              continue
            }
            out += acc.slice(from, open) + replacement
            from = open + block.length
            bytesSaved += block.length - replacement.length
            extended = true
          }
          return out + acc.slice(from)
        }, text)
      )
      if (extended) extendedKeys.push(key)
      return next
    }, named)

  const notHoisted = propertyKeys.filter((key) => !keyNamesType(rewritten, key, name))
  if (notHoisted.length > 0) {
    throw new Error(
      `Cannot hoist '${name}': ${notHoisted.length} of ${propertyKeys.length} keys print a DIFFERENT shape ` +
        `(${notHoisted.slice(0, 5).join(', ')}${notHoisted.length > 5 ? ', …' : ''}). ` +
        'They neither equal nor extend the shape the other keys share, so one alias cannot stand for them.'
    )
  }

  return {
    texts: rewritten,
    body: dedentPrintedType(anchor),
    replacements,
    extendedKeys,
    bytesSaved,
  }
}
