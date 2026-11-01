/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The token roles `design.code.tokens` accepts: one per colour the default
 * light code theme (`github-light`) paints a token with, so the role of a span
 * is decidable from the colour the highlighter already resolved, in every
 * grammar it knows. The theme's other colours (plain text, invalid code, a
 * removed diff line, bracket highlights) are not roles and keep the theme's.
 */
export const CODE_TOKEN_ROLES = [
  'comment',
  'keyword',
  'string',
  'constant',
  'function',
  'tag',
  'variable',
] as const

/** One of {@link CODE_TOKEN_ROLES}. */
export type CodeTokenRole = (typeof CODE_TOKEN_ROLES)[number]

/**
 * The NAME of a colour token, never a literal. Left an open string on purpose:
 * a literal or an undeclared name is refused one level up, by the cross-key
 * rule that resolves the name against the design and measures its contrast, so
 * the error can name the role, the token and what the design declares.
 */
const codeTokenReference = (paints: string) =>
  Schema.optional(
    Schema.String.annotate({
      description: `Colour token that paints ${paints}. A name declared in \`design.colors\` (its \`design.darkColors\` value paints the dark scheme), never a literal colour. Must reach 4.5:1 on the code block in both colour schemes, or the config is refused.`,
      examples: ['brand-ink'],
    })
  )

/** Each role mapped to the colour token that paints it. A role left out keeps the default colours. */
export const DesignCodeTokensSchema = Schema.Struct({
  comment: codeTokenReference('comments'),
  keyword: codeTokenReference('keywords, storage words and operators (`export`, `const`, `=>`)'),
  string: codeTokenReference('strings and regular expressions'),
  constant: codeTokenReference('numbers, constants, built-in types and JSON property names'),
  function: codeTokenReference('function, class and other declared names'),
  tag: codeTokenReference('tag names in markup and the keys of YAML'),
  variable: codeTokenReference('variables and parameters'),
}).annotate({
  title: 'Code Token Colours',
  description:
    'Colour of each syntax role in every code block (a `code` component, a markdown fence, a code block in an ai-chat answer), as the name of a colour token. A role left out keeps the default `github-light` / `github-dark` colour. Once declared, every token span of a role also carries the class `tok-<role>`.',
  examples: [{ comment: 'ink-quiet', keyword: 'brand', string: 'leaf' }],
})

/**
 * How code blocks are drawn, from the design. Absent, every code block draws
 * the default `github-light` / `github-dark` pair, byte for byte as before.
 */
export const DesignCodeSchema = Schema.Struct({
  tokens: Schema.optional(DesignCodeTokensSchema),
}).annotate({
  title: 'Code Blocks',
  description:
    'How code blocks take the design: `tokens` colours each syntax role from a colour token. Absent, code blocks draw the default `github-light` / `github-dark` colours.',
})

/** @public */
export type DesignCode = Schema.Schema.Type<typeof DesignCodeSchema>
