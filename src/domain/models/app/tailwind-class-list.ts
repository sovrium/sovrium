/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * A Tailwind class list an author may write into a config.
 *
 * ## Why this exists
 *
 * A class list is the ONE place in AppSchema where an author hands the renderer
 * a string that becomes CSS verbatim. `RESERVED_PROPS` in
 * `src/presentation/rendering/prop-conversion.ts` passes `className` and
 * `style` through raw, and nothing anywhere in `src/` sanitises either — so
 * before this schema, a `className` whose arbitrary value wrapped `url(`
 * around a third-party address was a valid config that made the running app
 * fetch that asset on every render.
 *
 * That class is DESCRIBED rather than written out because the build-time CSS
 * candidate scanner (`scripts/build/generate-css-assets.ts`) harvests
 * class-shaped tokens from comments too, so a literal example would enter
 * `BUILTIN_CSS_CANDIDATES` and ship a dead rule naming that address in every
 * stylesheet.
 *
 * Such a class is not a styling choice; it is an outbound request declared in a
 * styling field. Five CSS constructs do it, and this schema refuses all five
 * inside an arbitrary value:
 *
 * | Construct      | What it actually does                                             |
 * | -------------- | ----------------------------------------------------------------- |
 * | `url(`         | Fetches a resource — any origin, on every render                  |
 * | `image-set(`   | The same, with a resolution-picked set of them                    |
 * | `attr(`        | Reads a DOM attribute into rendered content                       |
 * | `expression(`  | Legacy IE construct that EXECUTES script from a stylesheet        |
 * | `@import`      | Pulls a remote stylesheet into the document                       |
 *
 * ## What stays legal, deliberately
 *
 * **Arbitrary values in general.** `bg-[oklch(0.5_0.1_250)]` and
 * `text-(length:--sv-density-text)` are the whole reason arbitrary values
 * exist, and the second is how the density tokens (`design.density`) reach a
 * recipe at all. Refusing the bracket syntax wholesale would break the feature
 * this validation ships alongside.
 *
 * **`$var` substitution tokens.** `text-$color` and `max-w-$width` are the
 * documented template surface (`ComponentPropsSchema`), and substitution runs
 * AFTER decode in `prop-conversion.ts`. A `$var` therefore carries no bracket
 * segment at decode time and is invisible to this check.
 *
 * That last point is a REAL and recorded gap, not an oversight: a `$var` whose
 * substituted value contains `url(` escapes this schema, because the value is
 * not present when the config is decoded. Closing it needs a post-substitution
 * check at the `prop-conversion.ts` boundary, which is jalon-2 work and is
 * filed there. What is closed here is the literal case, which is the one an
 * author writes and the one a config review reads.
 *
 * **The empty string.** `className: ''` is how a caller says "no extra
 * classes", and refusing it would make the schema harder to compose than the
 * raw string it replaces.
 *
 * ## Scope: the ARBITRARY SEGMENT, not the whole token
 *
 * The check reads each whitespace-delimited token, finds its first `[` or `(`,
 * and tests everything from there to the end of the token. Anything before
 * that opening delimiter is a Tailwind utility name and cannot carry CSS.
 *
 * Taking the segment to the END of the token rather than to a matching bracket
 * is deliberate: arbitrary values nest parens freely (`bg-[oklch(…)]`), so any
 * balanced-delimiter scan is a parser with its own bugs, and the failure mode
 * of a buggy one is a MISSED construct. Reading to the token boundary cannot
 * miss.
 *
 * The consequence is that `@import` outside a bracket — a bare `@import` token
 * — is not flagged. That is correct rather than tolerated: `@` is Tailwind's
 * container-query variant prefix (`@md:p-4`), a bare `@import` token generates
 * no CSS, and broadening the check to raw tokens would refuse legitimate
 * container-query classes.
 */

/** The five constructs refused inside an arbitrary value. Order is report order. */
const FORBIDDEN_CONSTRUCTS: ReadonlyArray<{
  readonly needle: string
  readonly remedy: string
}> = [
  {
    needle: 'url(',
    remedy:
      'Reference an asset through `design.imagery` or a `design.*` token and use the generated utility instead.',
  },
  {
    needle: 'image-set(',
    remedy:
      'Reference an asset through `design.imagery` or a `design.*` token and use the generated utility instead.',
  },
  {
    needle: 'attr(',
    remedy:
      "Content belongs in the component's own props (`content`, `children`), not in a class list.",
  },
  {
    needle: 'expression(',
    remedy: 'It executes script from a stylesheet and has no legitimate use in a Sovrium config.',
  },
  {
    needle: '@import',
    remedy:
      'A stylesheet is not something a class list may pull in. Declare the styling through `design` so it is compiled with the app.',
  },
]

/**
 * The arbitrary-value segment of one class token, or `undefined` when it has
 * none. See the module doc for why this runs to the end of the token.
 */
const arbitrarySegment = (token: string): string | undefined => {
  const bracket = token.indexOf('[')
  const paren = token.indexOf('(')
  const first = bracket === -1 ? paren : paren === -1 ? bracket : bracket < paren ? bracket : paren
  return first === -1 ? undefined : token.slice(first)
}

/**
 * Validate one class list, returning the offending construct's message or
 * `true`.
 *
 * Exported as a plain predicate because two callers need the SAME message: the
 * schema below, and the record-level check on `ComponentPropsSchema`, which
 * validates the `className` / `class` values of a `Schema.Record` it cannot
 * reach with a per-value schema.
 */
export const validateTailwindClassList = (value: string): string | true => {
  const violation = value
    .split(/\s+/)
    .flatMap((token) => {
      const segment = arbitrarySegment(token)
      if (segment === undefined) return []
      const lowered = segment.toLowerCase()
      const construct = FORBIDDEN_CONSTRUCTS.find((candidate) => lowered.includes(candidate.needle))
      return construct ? [{ token, construct }] : []
    })
    .at(0)

  if (violation === undefined) return true
  return `\`className\` may not carry \`${violation.construct.needle}\` inside an arbitrary value (found in \`${violation.token}\`). ${violation.construct.remedy}`
}

/**
 * A Tailwind class list: space-separated utilities, arbitrary values allowed,
 * asset-fetching and script-executing CSS constructs refused.
 */
export const TailwindClassListSchema = Schema.String.pipe(
  Schema.annotate({
    identifier: 'TailwindClassList',
    title: 'Tailwind Class List',
    description:
      'Space-separated Tailwind utilities. Arbitrary values (`bg-[oklch(…)]`, `text-(length:--sv-density-text)`) and `$var` substitution tokens are allowed; `url(`, `image-set(`, `attr(`, `expression(` and `@import` are refused inside an arbitrary value.',
    examples: ['p-4 md:p-8', 'bg-[oklch(0.5_0.1_250)] text-(length:--sv-density-text)', ''],
  }),
  Schema.check(
    Schema.makeFilter((value: string) => {
      const violation = validateTailwindClassList(value)
      return violation === true ? true : violation
    })
  )
)

/** @public */
export type TailwindClassList = Schema.Schema.Type<typeof TailwindClassListSchema>
