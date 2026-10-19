/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * Contract for Tokens Studio's multi-set token files — the format its Figma
 * plugin syncs and the one Penpot reads.
 *
 * ─── SETS, THEMES, ORDER ───────────────────────────────────────────────────
 *
 * Tokens live in SETS. A set is a file of a synced folder (`base/options.json`)
 * or, in the single-file shape, a top-level key of one JSON document. Beside
 * the sets sit two reserved entries:
 *
 * - `$themes`: a list of themes, each choosing sets as `enabled` (its tokens
 *   are output), `source` (read to resolve aliases, never output) or
 *   `disabled`;
 * - `$metadata`: the `tokenSetOrder`, later sets overriding earlier ones.
 *
 * Neither is a unique key: upstream samples give two themes the same `id`, and
 * a `tokenSetOrder` may name sets the folder does not carry. A reader keys on
 * the theme's position and name, never its id, and ignores an order entry
 * with no set behind it.
 *
 * ─── TWO TOKEN FORMS ───────────────────────────────────────────────────────
 *
 * A token is legacy `{ value, type }` or W3C DTCG `{ $value, $type }`, as the
 * plugin's token-format setting chooses. A value may hold aliases, `{a.b}`,
 * inside a larger expression (`rgba({colors.gray.100}, 0.5)`), and a math
 * expression (`$sizing.base * 2`).
 */

const tokenValueSchema = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Array(Schema.Unknown),
  Schema.Record(Schema.String, Schema.Unknown),
]).annotate({
  description:
    'The value: a string that may hold `{alias}` references or a math expression, a number, a list (shadows) or an object (composition, typography)',
})

const extensionsField = optionalField(
  Schema.Record(Schema.String, Schema.Unknown).annotate({
    description: 'Extensions, such as the colour `modify` operation',
  })
)

/** A token in the legacy `value`/`type` form. */
export const tokensStudioLegacyTokenSchema = Schema.Struct({
  value: tokenValueSchema,
  type: Schema.String.annotate({
    description: 'The Tokens Studio token type',
    examples: ['color', 'borderRadius', 'spacing', 'fontFamilies', 'sizing', 'boxShadow'],
  }),
  description: optionalField(Schema.String.annotate({ description: 'The token description' })),
  $extensions: extensionsField,
}).annotate({ identifier: 'TokensStudioLegacyToken' })

/** A token in the W3C DTCG `$value`/`$type` form. */
export const tokensStudioDtcgTokenSchema = Schema.Struct({
  $value: tokenValueSchema,
  $type: Schema.String.annotate({
    description: 'The Tokens Studio token type',
    examples: ['color', 'borderRadius', 'spacing', 'fontFamilies'],
  }),
  $description: optionalField(Schema.String.annotate({ description: 'The token description' })),
  $extensions: extensionsField,
}).annotate({ identifier: 'TokensStudioDtcgToken' })

/** A token or a group of further nodes. */
export type TokensStudioNode =
  | typeof tokensStudioLegacyTokenSchema.Type
  | typeof tokensStudioDtcgTokenSchema.Type
  | { readonly [name: string]: TokensStudioNode }

// The explicit annotation is what makes the recursion typeable.
const tokensStudioNodeSchema: Schema.Codec<TokensStudioNode> = Schema.suspend(
  (): Schema.Codec<TokensStudioNode> =>
    Schema.Union([
      tokensStudioDtcgTokenSchema,
      tokensStudioLegacyTokenSchema,
      Schema.Record(Schema.String, tokensStudioNodeSchema),
    ])
)

/**
 * One token set: groups nested to any depth, every leaf a token.
 *
 * @public Authored ahead of the adapter: the bundle's Tokens Studio projection
 * and the import adapter adopt it when they ship.
 */
export const tokensStudioTokenSetSchema = Schema.Record(
  Schema.String,
  tokensStudioNodeSchema
).annotate({ identifier: 'TokensStudioTokenSet', description: 'One Tokens Studio token set' })

/** What a theme does with one set. */
export const tokensStudioSetStatusSchema = Schema.Literals([
  'enabled',
  'source',
  'disabled',
]).annotate({
  description:
    '`enabled`: its tokens are output; `source`: read only to resolve aliases; `disabled`: ignored',
})

/** One theme of `$themes`. */
export const tokensStudioThemeSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Theme id; NOT unique in practice' }),
  name: Schema.String.annotate({
    description: 'Theme name, the key a reader uses',
    examples: ['Light', 'Dark'],
  }),
  group: optionalField(Schema.String.annotate({ description: 'The theme group, such as `Mode`' })),
  selectedTokenSets: Schema.Record(Schema.String, tokensStudioSetStatusSchema).annotate({
    description: 'Set name to what the theme does with it',
  }),
}).annotate({ identifier: 'TokensStudioTheme' })

/**
 * The `$themes` list — `$themes.json` in a synced folder.
 *
 * @public
 */
export const tokensStudioThemesSchema = Schema.Array(tokensStudioThemeSchema).annotate({
  identifier: 'TokensStudioThemes',
})

/**
 * The `$metadata` entry — `$metadata.json` in a synced folder.
 *
 * @public
 */
export const tokensStudioMetadataSchema = Schema.Struct({
  tokenSetOrder: Schema.Array(Schema.String).annotate({
    description: 'Set names, later ones overriding earlier ones',
  }),
}).annotate({ identifier: 'TokensStudioMetadata' })

/**
 * The reserved entries of the single-file shape. Every other top-level key is
 * a set, decoded with {@link tokensStudioTokenSetSchema}.
 *
 * @public
 */
export const tokensStudioSingleFileSchema = Schema.Struct({
  $themes: tokensStudioThemesSchema,
  $metadata: tokensStudioMetadataSchema,
}).annotate({ identifier: 'TokensStudioSingleFile' })

/** @public */
export type TokensStudioTheme = typeof tokensStudioThemeSchema.Type
/** @public */
export type TokensStudioSingleFile = typeof tokensStudioSingleFileSchema.Type
