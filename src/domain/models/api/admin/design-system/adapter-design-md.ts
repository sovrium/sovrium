/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/kernel/config-parsing/optional-field'

/**
 * Contract for the YAML front matter of a `DESIGN.md`, the file design agents
 * read to stay on an app's design system.
 *
 * The front matter is the machine-readable token layer; the markdown body
 * under it explains how to apply the tokens. `sovrium design-system --format
 * design-md` writes one, and the bundle carries the same file under
 * `adapters/design-md/`.
 *
 * ─── EXACTLY SEVEN KEYS ────────────────────────────────────────────────────
 *
 * `name`, `description`, `colors`, `typography`, `rounded`, `spacing` and
 * `components`. The format has no top-level group for shadows, motion or
 * breakpoints: those belong to the sidecar's `extensions`
 * (`adapter-design-md-sidecar.ts`). The schema is STRICT at every depth, so a
 * stray group, or a component property the format does not have, fails the
 * decode instead of being dropped by the reader that meets it.
 *
 * ─── EIGHT COMPONENT PROPERTIES ────────────────────────────────────────────
 *
 * A component entry is limited to {@link DESIGN_MD_COMPONENT_PROPERTIES}.
 * A value may name a token as `{group.token}`, such as `{colors.primary}`.
 */

/** The only properties a front-matter component may carry, in the format's order. */
export const DESIGN_MD_COMPONENT_PROPERTIES = [
  'backgroundColor',
  'textColor',
  'typography',
  'rounded',
  'padding',
  'size',
  'height',
  'width',
] as const

/**
 * The eight body sections, in their fixed order: the id a narrative block is
 * keyed by, and the heading exactly as the format spells it.
 */
export const DESIGN_MD_SECTIONS = [
  { id: 'overview', heading: 'Overview' },
  { id: 'colors', heading: 'Colors' },
  { id: 'typography', heading: 'Typography' },
  { id: 'layout', heading: 'Layout' },
  { id: 'elevation', heading: 'Elevation & Depth' },
  { id: 'shapes', heading: 'Shapes' },
  { id: 'components', heading: 'Components' },
  { id: 'dos-and-donts', heading: "Do's and Don'ts" },
] as const

/** A numeric CSS value a reader may also find written as a string. */
const numberOrString = Schema.Union([Schema.Finite, Schema.String])

/** One text role: its face and its measures, each optional. */
export const designMdTypographySchema = Schema.Struct({
  fontFamily: optionalField(
    Schema.String.annotate({
      description: 'The face, with its fallbacks, as a CSS font-family list',
      examples: ['Geist Variable, sans-serif'],
    })
  ),
  fontSize: optionalField(
    Schema.String.annotate({ description: 'The size, as a CSS length', examples: ['2.25rem'] })
  ),
  fontWeight: optionalField(
    numberOrString.annotate({ description: 'The weight', examples: [600] })
  ),
  lineHeight: optionalField(
    numberOrString.annotate({ description: 'The leading', examples: [1.15] })
  ),
  letterSpacing: optionalField(
    Schema.String.annotate({ description: 'The tracking, as a CSS length', examples: ['-0.02em'] })
  ),
  fontFeature: optionalField(
    Schema.String.annotate({ description: 'OpenType features, as `font-feature-settings`' })
  ),
  fontVariation: optionalField(
    Schema.String.annotate({ description: 'Variable axes, as `font-variation-settings`' })
  ),
}).annotate({ identifier: 'DesignMdTypography' })

const componentValue = (description: string) =>
  optionalField(
    Schema.String.annotate({
      description: `${description}; a literal or a \`{group.token}\` reference`,
    })
  )

/** One component variant, limited to the eight properties the format allows. */
export const designMdComponentSchema = Schema.Struct({
  backgroundColor: componentValue('The fill'),
  textColor: componentValue('The text colour'),
  typography: componentValue('The text role'),
  rounded: componentValue('The corner radius'),
  padding: componentValue('The inner padding'),
  size: componentValue('The size'),
  height: componentValue('The height'),
  width: componentValue('The width'),
}).annotate({ identifier: 'DesignMdComponent' })

/** A token group keyed by token name, each value a CSS string. */
const tokenGroup = (description: string) =>
  Schema.Record(Schema.String, Schema.String).annotate({ description })

/** The YAML front matter of a DESIGN.md. Strict: an unknown key at any depth is refused. */
export const designMdFrontMatterSchema = Schema.Struct({
  name: Schema.String.annotate({
    description: 'The name of the design system, the app it styles',
    examples: ['harbour-ops'],
  }).check(Schema.isMinLength(1)),
  description: Schema.String.annotate({ description: 'One line saying what the design system is' }),
  colors: tokenGroup('Every colour, keyed by token name, as a CSS colour string'),
  typography: Schema.Record(Schema.String, designMdTypographySchema).annotate({
    description: 'Text roles, keyed by role name',
  }),
  rounded: tokenGroup('Corner radii, keyed by step, as CSS lengths'),
  spacing: tokenGroup('Spacing steps, keyed by step, as CSS lengths'),
  components: Schema.Record(Schema.String, designMdComponentSchema).annotate({
    description: 'Component variants, keyed by name, such as `button-primary`',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'DesignMdFrontMatter',
})

/** @public */
export type DesignMdFrontMatter = Schema.Schema.Type<typeof designMdFrontMatterSchema>
