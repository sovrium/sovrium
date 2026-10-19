/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * Contract for the `tokens.json` of a Claude Design "Design System" artifact
 * (contract 0.2.47).
 *
 * The bundle's Claude Design adapter writes one of these at
 * `adapters/claude-design/project/tokens.json`, and `sovrium design-system
 * import` reads one back. Both directions decode against THIS schema, so the
 * two cannot drift into two readings of the same file.
 *
 * ─── A LIST PER FAMILY, NEVER A MAP ────────────────────────────────────────
 *
 * Every family except `type` is `{ tokens: [{ name, value, usage }] }`. A DTCG
 * name-to-value map is valid JSON that the artifact page cannot read: the
 * family shows empty and its entries are dropped at the first edit. The
 * colour family adds `themes`, and a colour value is either one string (the
 * first theme) or one string per theme id.
 *
 * ─── LITERAL VALUES ONLY ───────────────────────────────────────────────────
 *
 * A colour is a hex literal, a colour function with plain numeric arguments,
 * or an alias `{other-token}`. `var()`, `color-mix()`, `url()` and named
 * colours are dropped by the reader, so a value carrying one is refused here
 * rather than written and silently lost.
 */

/** Token and style names: case kept, at most 64 characters. */
const CLAUDE_DESIGN_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/

/**
 * A colour the artifact reads: hex, a colour function with no nested call, or
 * an alias to another colour token.
 */
const CLAUDE_DESIGN_COLOR_PATTERN =
  /^(?:#[0-9a-fA-F]{3,4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^()]*\)|\{[A-Za-z0-9][A-Za-z0-9_.-]{0,63}\})$/

/** A theme id or family key: the token-name grammar, lower-case. */
const CLAUDE_DESIGN_KEY_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,63}$/

const tokenNameSchema = Schema.String.annotate({
  description: 'Token name, case kept; every family but `type` shares one `--name` namespace',
  examples: ['primary', 'space-4', 'radius-md'],
}).check(Schema.isPattern(CLAUDE_DESIGN_NAME_PATTERN))

/** One colour value, refused when it holds a reference the artifact cannot resolve. */
export const claudeDesignColorValueSchema = Schema.String.annotate({
  description:
    'A hex colour, a colour function with plain numeric arguments, or an alias `{other-token}`. Never `var()`, `color-mix()` or `url()`.',
  examples: ['#1d4ed8', 'oklch(0.62 0.19 259)', '{primary}'],
}).check(Schema.isPattern(CLAUDE_DESIGN_COLOR_PATTERN))

/** One colour theme. The first is the one a plain-string value belongs to. */
export const claudeDesignThemeSchema = Schema.Struct({
  id: Schema.String.annotate({
    description: 'Theme id, lower-case; the key of a per-theme colour value',
    examples: ['light', 'dark'],
  }).check(Schema.isPattern(CLAUDE_DESIGN_KEY_PATTERN)),
  name: Schema.String.annotate({
    description: 'Theme label shown by the artifact',
    examples: ['Light', 'Dark'],
  }),
}).annotate({ identifier: 'ClaudeDesignTheme' })

/** One colour token, with one value or one value per theme. */
export const claudeDesignColorTokenSchema = Schema.Struct({
  name: tokenNameSchema,
  value: Schema.Union([
    claudeDesignColorValueSchema,
    Schema.Record(Schema.String, claudeDesignColorValueSchema),
  ]).annotate({
    description: 'One colour for the first theme, or one colour per theme id',
  }),
  usage: optionalField(
    Schema.String.annotate({ description: 'When to use the token, at most 1000 characters' })
  ),
}).annotate({ identifier: 'ClaudeDesignColorToken' })

/** One token of a length family (`spacing`, `radius`): a CSS length or a number of px. */
export const claudeDesignLengthTokenSchema = Schema.Struct({
  name: tokenNameSchema,
  value: Schema.Union([
    Schema.String.annotate({ description: 'A CSS length', examples: ['16px', '0.75rem', '0'] }),
    Schema.Finite.annotate({ description: 'A length in px' }),
  ]).annotate({ description: 'The length' }),
  usage: optionalField(Schema.String.annotate({ description: 'When to use the token' })),
}).annotate({ identifier: 'ClaudeDesignLengthToken' })

/** One token of any further family (`shadow`, `size`, `opacity` …), kept as the reader keeps it. */
const otherTokenSchema = Schema.Struct({
  name: tokenNameSchema,
  value: Schema.Union([
    Schema.String,
    Schema.Finite,
    Schema.Record(Schema.String, Schema.String),
  ]).annotate({ description: 'A plain CSS value, or one value per colour theme' }),
  usage: optionalField(Schema.String.annotate({ description: 'When to use the token' })),
}).annotate({ identifier: 'ClaudeDesignOtherToken' })

const familyNoteField = optionalField(
  Schema.String.annotate({ description: 'A note shown above the family, at most 400 characters' })
)

/** One text style of a type group. */
export const claudeDesignTextStyleSchema = Schema.Struct({
  name: tokenNameSchema,
  fontSize: Schema.Union([Schema.String, Schema.Finite]).annotate({
    description: 'The size, a CSS length or a number of px',
    examples: ['15px', '1rem'],
  }),
  lineHeight: optionalField(
    Schema.Union([Schema.String, Schema.Finite]).annotate({
      description: 'A length, or a unitless number below 10',
    })
  ),
  fontWeight: optionalField(
    Schema.Union([Schema.Finite, Schema.String]).annotate({
      description: 'A weight from 1 to 1000, or a range such as `"300 800"`',
    })
  ),
  letterSpacing: optionalField(Schema.String.annotate({ description: 'A CSS length' })),
  fontStyle: optionalField(
    Schema.Literals(['normal', 'italic']).annotate({ description: 'Style' })
  ),
  family: optionalField(
    Schema.String.annotate({ description: 'A family key overriding the group family' })
  ),
  sample: optionalField(Schema.String.annotate({ description: 'Sample text' })),
  usage: optionalField(Schema.String.annotate({ description: 'When to use the style' })),
}).annotate({ identifier: 'ClaudeDesignTextStyle' })

/** The `type` family: fonts, family stacks, and text styles in groups. */
export const claudeDesignTypeSchema = Schema.Struct({
  fonts: Schema.Array(
    Schema.Struct({
      family: Schema.String.annotate({ description: 'A bare family name, no quotes' }),
      file: Schema.String.annotate({
        description: 'The font file; a bare name means `fonts/<file>`',
      }),
      weight: optionalField(Schema.String.annotate({ description: 'A CSS weight descriptor' })),
      style: optionalField(
        Schema.Literals(['normal', 'italic', 'oblique']).annotate({ description: 'Style' })
      ),
    }).annotate({ identifier: 'ClaudeDesignFont' })
  ).annotate({ description: 'The font files the system ships' }),
  families: Schema.Record(Schema.String, Schema.String).annotate({
    description: 'Family key to CSS font-family stack',
  }),
  groups: Schema.Array(
    Schema.Struct({
      name: Schema.String.annotate({ description: 'Group label' }),
      family: Schema.String.annotate({ description: 'The family key its styles use' }),
      note: optionalField(Schema.String.annotate({ description: 'A note on the group' })),
      styles: Schema.Array(claudeDesignTextStyleSchema).annotate({
        description: 'The text styles of the group',
      }),
    }).annotate({ identifier: 'ClaudeDesignTypeGroup' })
  ).annotate({ description: 'Text styles, grouped' }),
}).annotate({ identifier: 'ClaudeDesignType' })

/**
 * The whole `tokens.json`. Families the contract names are typed; any other
 * top-level `{ tokens: [...] }` family is accepted and kept, since the reader
 * shows it as its own section.
 *
 * @public Authored ahead of the adapter: the bundle's Claude Design projection
 * and the import adapter adopt it when they ship.
 */
export const claudeDesignTokensSchema = Schema.Struct({
  name: optionalField(Schema.String.annotate({ description: 'The design system name' })),
  version: optionalField(Schema.Literal(1).annotate({ description: 'The tokens file version' })),
  color: Schema.Struct({
    note: familyNoteField,
    themes: Schema.Array(claudeDesignThemeSchema).annotate({
      description: 'The colour themes, first one the default; at most 8',
    }),
    tokens: Schema.Array(claudeDesignColorTokenSchema).annotate({
      description: 'Every colour, one flat list',
    }),
  }).annotate({ identifier: 'ClaudeDesignColorFamily' }),
  type: optionalField(claudeDesignTypeSchema),
  spacing: optionalField(
    Schema.Struct({
      note: familyNoteField,
      tokens: Schema.Array(claudeDesignLengthTokenSchema).annotate({ description: 'Spacing' }),
    }).annotate({ identifier: 'ClaudeDesignSpacingFamily' })
  ),
  radius: optionalField(
    Schema.Struct({
      note: familyNoteField,
      tokens: Schema.Array(claudeDesignLengthTokenSchema).annotate({ description: 'Radii' }),
    }).annotate({ identifier: 'ClaudeDesignRadiusFamily' })
  ),
  shadow: optionalField(
    Schema.Struct({
      note: familyNoteField,
      tokens: Schema.Array(otherTokenSchema).annotate({ description: 'Box shadows' }),
    }).annotate({ identifier: 'ClaudeDesignShadowFamily' })
  ),
}).annotate({ identifier: 'ClaudeDesignTokens' })

/** @public */
export type ClaudeDesignTokens = typeof claudeDesignTokensSchema.Type
/** @public */
export type ClaudeDesignColorToken = typeof claudeDesignColorTokenSchema.Type
