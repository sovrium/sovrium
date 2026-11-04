/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/kernel/config-parsing/optional-field'

/**
 * Contract for `.impeccable/design.json`, the sidecar written beside a
 * `DESIGN.md` (schema version 2).
 *
 * The DESIGN.md front matter (`adapter-design-md.ts`) holds the token
 * primitives. The sidecar holds what the front matter cannot: per-colour
 * metadata, shadows, motion, breakpoints, component snippets a design tool
 * renders, and the narrative. It extends the front matter and never repeats a
 * value in a second notation, so its colour and type entries are keyed by the
 * front matter's own token names.
 *
 * ─── WHAT SOVRIUM ADDS ─────────────────────────────────────────────────────
 *
 * Every Sovrium entry is optional here, so a sidecar another producer wrote
 * still decodes:
 *
 * - `colorMeta.<name>.dark`: the value the app paints under `.dark`. The
 *   front matter has one value per colour, the light one.
 * - `colorMeta.<name>.provenance` and `.source`: whether the app declared the
 *   colour or inherited it from the platform, and the config key that set it.
 * - `typographyMeta.<role>.rung`: the Sovrium type rung a role was read from,
 *   such as `h1` for `headline`.
 * - `extensions.typeLadder`, `extensions.componentClasses` and
 *   `extensions.density`: the declared rungs in order, the classes
 *   `design.components` gives each component, and the density step per zone.
 *
 * Keys this schema does not name are kept, not refused: a reader may add its own.
 */

/** Who chose a value: the app's config, or the platform it inherits from. */
export const designMdProvenanceSchema = Schema.Literals(['declared', 'inherited']).annotate({
  description: '`declared` when the config sets the value, `inherited` when the platform does',
})

/** The metadata of one front-matter colour. */
export const designMdColorMetaSchema = Schema.Struct({
  role: optionalField(
    Schema.String.annotate({ description: 'The role the colour plays', examples: ['primary'] })
  ),
  displayName: optionalField(Schema.String.annotate({ description: 'A readable name' })),
  canonical: optionalField(
    Schema.String.annotate({ description: 'The canonical value, when the front matter rounds it' })
  ),
  tonalRamp: optionalField(
    Schema.Array(Schema.String).annotate({ description: 'Tones of the colour, dark to light' })
  ),
  dark: optionalField(
    Schema.String.annotate({
      description: 'The value painted under `.dark`, as a CSS colour string',
      examples: ['oklch(0.78 0.12 10)'],
    })
  ),
  provenance: optionalField(designMdProvenanceSchema),
  source: optionalField(
    Schema.String.annotate({
      description: 'The config key that sets the light value, absent for an inherited colour',
      examples: ['design.colors.primary'],
    })
  ),
}).annotate({ identifier: 'DesignMdColorMeta' })

/** The metadata of one front-matter text role, or of a face no role carries. */
export const designMdTypographyMetaSchema = Schema.Struct({
  displayName: optionalField(Schema.String.annotate({ description: 'A readable name' })),
  purpose: optionalField(Schema.String.annotate({ description: 'Where the role is used' })),
  rung: optionalField(
    Schema.String.annotate({
      description: 'The Sovrium type rung the role was read from',
      examples: ['h1'],
    })
  ),
  fontFamily: optionalField(
    Schema.String.annotate({
      description: 'The face, for an entry no front-matter role carries',
      examples: ['Geist Mono Variable, monospace'],
    })
  ),
}).annotate({ identifier: 'DesignMdTypographyMeta' })

/** A named value with an optional purpose: one shadow, one motion token. */
const namedValueSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'Token name', examples: ['md'] }),
  value: Schema.String.annotate({ description: 'The CSS value' }),
  purpose: optionalField(Schema.String.annotate({ description: 'When to use it' })),
}).annotate({ identifier: 'DesignMdNamedValue' })

/** A breakpoint: a name and the width it starts at. */
const breakpointSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'Breakpoint name', examples: ['md'] }),
  value: Schema.String.annotate({ description: 'The min-width it starts at', examples: ['768px'] }),
}).annotate({ identifier: 'DesignMdBreakpoint' })

/** The kinds of component a design tool knows how to lay out. */
export const designMdComponentKindSchema = Schema.Literals([
  'button',
  'input',
  'nav',
  'chip',
  'card',
  'custom',
]).annotate({ description: 'What kind of component the snippet is' })

/** One component, as a self-contained snippet a design tool renders. */
export const designMdSidecarComponentSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'Component name', examples: ['Primary Button'] }),
  kind: designMdComponentKindSchema,
  refersTo: optionalField(
    Schema.String.annotate({
      description: 'The front-matter component key it draws',
      examples: ['button-primary'],
    })
  ),
  description: optionalField(Schema.String.annotate({ description: 'What it is, and when' })),
  html: Schema.String.annotate({ description: 'The markup, with `ds-` prefixed classes' }),
  css: Schema.String.annotate({ description: 'The styles of those classes, self-contained' }),
}).annotate({ identifier: 'DesignMdSidecarComponent' })

/** A named rule and the body section it belongs to. */
const ruleSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'The rule name' }),
  body: Schema.String.annotate({ description: 'The rule' }),
  section: optionalField(Schema.String.annotate({ description: 'The section it belongs to' })),
}).annotate({ identifier: 'DesignMdRule' })

/** The sidecar of a DESIGN.md. */
export const designMdSidecarSchema = Schema.Struct({
  schemaVersion: Schema.Literal(2).annotate({ description: 'Sidecar format version' }),
  generatedAt: Schema.String.annotate({
    description: 'An ISO-8601 instant; a Sovrium export writes the Unix epoch, so reruns match',
    examples: ['1970-01-01T00:00:00Z'],
  }),
  title: Schema.String.annotate({
    description: 'The title of the design system',
    examples: ['Design System: harbour-ops'],
  }),
  extensions: Schema.Struct({
    colorMeta: Schema.Record(Schema.String, designMdColorMetaSchema).annotate({
      description: 'Per-colour metadata, keyed by front-matter colour name',
    }),
    typographyMeta: Schema.Record(Schema.String, designMdTypographyMetaSchema).annotate({
      description: 'Per-role metadata, keyed by front-matter role name or face name',
    }),
    shadows: Schema.Array(namedValueSchema).annotate({ description: 'The shadow ladder' }),
    motion: Schema.Array(namedValueSchema).annotate({ description: 'Durations and easings' }),
    breakpoints: Schema.Array(breakpointSchema).annotate({ description: 'The breakpoints' }),
    typeLadder: optionalField(
      Schema.Array(Schema.String).annotate({
        description: 'The declared Sovrium type rungs, largest first',
      })
    ),
    componentClasses: optionalField(
      Schema.Record(Schema.String, Schema.String).annotate({
        description: 'The classes `design.components` gives each component type',
      })
    ),
    density: optionalField(
      Schema.Record(Schema.String, Schema.String).annotate({
        description: 'The density step per zone, with the app-wide step under `default`',
      })
    ),
  }).annotate({ description: 'What the front matter cannot hold' }),
  components: Schema.Array(designMdSidecarComponentSchema).annotate({
    description: 'Component snippets a design tool renders',
  }),
  narrative: Schema.Struct({
    northStar: optionalField(Schema.String.annotate({ description: 'The named metaphor' })),
    overview: optionalField(Schema.String.annotate({ description: 'The Overview prose' })),
    keyCharacteristics: optionalField(
      Schema.Array(Schema.String).annotate({ description: 'Key characteristics' })
    ),
    rules: optionalField(Schema.Array(ruleSchema).annotate({ description: 'Named rules' })),
    dos: optionalField(Schema.Array(Schema.String).annotate({ description: "The Do's, verbatim" })),
    donts: optionalField(
      Schema.Array(Schema.String).annotate({ description: "The Don'ts, verbatim" })
    ),
  }).annotate({ description: 'The prose, as the DESIGN.md body says it' }),
}).annotate({ identifier: 'DesignMdSidecar' })

/** @public */
export type DesignMdSidecar = Schema.Schema.Type<typeof designMdSidecarSchema>
