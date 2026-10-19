/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * Contract for the DTCG token files Figma's native Variables import reads and
 * its export writes.
 *
 * It is DTCG with a narrower profile, and the narrowing is the whole reason
 * for a separate adapter:
 *
 * - a dimension is in `px` only. A `rem` value is refused by Figma, so the
 *   bundle converts at a 16px base on the way out and back on the way in;
 * - a duration is in seconds (`s`), never milliseconds;
 * - a font family is ONE string, not a fallback list;
 * - a file holds ONE mode. Light and dark are two files with the same token
 *   paths and the same types, because Figma creates a variable only for a
 *   token present in every file with the same `$type`.
 *
 * A value may also be an alias, `{group.token}`, which Figma resolves.
 */

const ALIAS_PATTERN = /^\{[^{}]+\}$/

const aliasSchema = Schema.String.annotate({
  description: 'A reference to another token, `{group.token}`',
  examples: ['{color.primary}'],
}).check(Schema.isPattern(ALIAS_PATTERN))

const extensionsField = optionalField(
  Schema.Record(Schema.String, Schema.Unknown).annotate({
    description: 'Vendor extensions, such as `com.figma.variableId` on an exported variable',
  })
)

const descriptionField = optionalField(
  Schema.String.annotate({ description: 'The token description' })
)

/** An sRGB or HSL colour object; Figma reads `hex` when present. */
export const figmaColorValueSchema = Schema.Struct({
  colorSpace: Schema.Literals(['srgb', 'hsl']).annotate({
    description: 'The colour space Figma accepts',
  }),
  components: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]).annotate({
    description: 'Three components in the colour space, sRGB on a 0–1 scale',
  }),
  alpha: optionalField(Schema.Finite.annotate({ description: 'Opacity, 0–1' })),
  hex: optionalField(
    Schema.String.annotate({ description: 'The same colour as a 6-digit hex' }).check(
      Schema.isPattern(/^#[0-9a-fA-F]{6}$/)
    )
  ),
}).annotate({ identifier: 'FigmaColorValue' })

const colorTokenSchema = Schema.Struct({
  $type: Schema.Literal('color').annotate({ description: 'Token type' }),
  $value: Schema.Union([figmaColorValueSchema, aliasSchema]).annotate({
    description: 'A colour object or an alias',
  }),
  $description: descriptionField,
  $extensions: extensionsField,
}).annotate({ identifier: 'FigmaColorToken' })

/** A length in px — the only unit Figma's import accepts. */
export const figmaDimensionValueSchema = Schema.Struct({
  value: Schema.Finite.annotate({ description: 'The length in px' }),
  unit: Schema.Literal('px').annotate({ description: 'Always `px`; `rem` is refused by Figma' }),
}).annotate({ identifier: 'FigmaDimensionValue' })

const dimensionTokenSchema = Schema.Struct({
  $type: Schema.Literal('dimension').annotate({ description: 'Token type' }),
  $value: Schema.Union([figmaDimensionValueSchema, aliasSchema]).annotate({
    description: 'A px length or an alias',
  }),
  $description: descriptionField,
  $extensions: extensionsField,
}).annotate({ identifier: 'FigmaDimensionToken' })

/** A duration in seconds — never milliseconds. */
export const figmaDurationValueSchema = Schema.Struct({
  value: Schema.Finite.annotate({ description: 'The duration in seconds' }),
  unit: Schema.Literal('s').annotate({ description: 'Always `s`' }),
}).annotate({ identifier: 'FigmaDurationValue' })

const durationTokenSchema = Schema.Struct({
  $type: Schema.Literal('duration').annotate({ description: 'Token type' }),
  $value: Schema.Union([figmaDurationValueSchema, aliasSchema]).annotate({
    description: 'A duration in seconds or an alias',
  }),
  $description: descriptionField,
  $extensions: extensionsField,
}).annotate({ identifier: 'FigmaDurationToken' })

const fontFamilyTokenSchema = Schema.Struct({
  $type: Schema.Literal('fontFamily').annotate({ description: 'Token type' }),
  $value: Schema.String.annotate({
    description: 'ONE family name; Figma does not read a fallback list',
    examples: ['Geist'],
  }),
  $description: descriptionField,
  $extensions: extensionsField,
}).annotate({ identifier: 'FigmaFontFamilyToken' })

const numberTokenSchema = Schema.Struct({
  $type: Schema.Literal('number').annotate({ description: 'Token type' }),
  $value: Schema.Union([Schema.Finite, aliasSchema]).annotate({
    description: 'A number; a boolean variable is a number with `com.figma.type` set',
  }),
  $description: descriptionField,
  $extensions: extensionsField,
}).annotate({ identifier: 'FigmaNumberToken' })

const stringTokenSchema = Schema.Struct({
  $type: Schema.Literal('string').annotate({ description: 'Token type' }),
  $value: Schema.String.annotate({ description: 'A string variable' }),
  $description: descriptionField,
  $extensions: extensionsField,
}).annotate({ identifier: 'FigmaStringToken' })

/** One token of the Figma profile. */
export const figmaTokenSchema = Schema.Union([
  colorTokenSchema,
  dimensionTokenSchema,
  durationTokenSchema,
  fontFamilyTokenSchema,
  numberTokenSchema,
  stringTokenSchema,
]).annotate({ identifier: 'FigmaToken' })

/** A token or a group of further nodes. */
export type FigmaDtcgNode =
  typeof figmaTokenSchema.Type | { readonly [name: string]: FigmaDtcgNode }

// The explicit annotation is what makes the recursion typeable.
const figmaNodeSchema: Schema.Codec<FigmaDtcgNode> = Schema.suspend(
  (): Schema.Codec<FigmaDtcgNode> =>
    Schema.Union([figmaTokenSchema, Schema.Record(Schema.String, figmaNodeSchema)])
)

/**
 * One Figma DTCG file: ONE mode, groups nested to any depth, every leaf a
 * token of the profile.
 *
 * @public Authored ahead of the adapter: the bundle's Figma projection and the
 * import adapter adopt it when they ship.
 */
export const figmaDtcgDocumentSchema = Schema.Record(Schema.String, figmaNodeSchema).annotate({
  identifier: 'FigmaDtcgDocument',
  description: 'One Figma Variables mode as a DTCG token tree',
})

/** @public */
export type FigmaDtcgDocument = typeof figmaDtcgDocumentSchema.Type
/** @public */
export type FigmaToken = typeof figmaTokenSchema.Type
