/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `preview` — one component type, drawn with ONE option set to ONE value.
 *
 * ## What it is for
 *
 * The design console's Configuration section has two phases. Phase A lists
 * every option a type accepts, straight from the schema — a table of paths,
 * kinds and defaults, which `GET /api/admin/schema/component-types/:type/options`
 * already serves. Phase B is the half a reader actually learns from: beside
 * `pagination.position: both`, the picture of a grid with pagers top and bottom.
 *
 * `preview` is that picture. It names a type, an option path and a value, and
 * draws the engine's own catalogue specimen for that type with that one option
 * applied.
 *
 * ## Why it is not `specimen`
 *
 * `specimen` names a subject along the axes a TYPE PAGE is organised by —
 * variant, size, state — which are the axes the catalogue publishes per type.
 * An option path is none of those: `columns[].format` is not a variant of
 * `table`, and there are two hundred of them on the largest type. Folding an
 * arbitrary option path into `SpecimenSubject` would make its four axis fields
 * into "four axes and also anything", which is the shape that stops a reader
 * being able to tell what a subject means.
 *
 * They do share the drawing: `preview` resolves through the same catalogue
 * specimen path, so a type that draws in the kit draws here, and one that
 * refuses (a `record-field` with no bound record) refuses here with the same
 * sentence rather than a second one written for this type.
 *
 * ## The three parts are all deferrable, because the console is one page
 *
 * A Configuration section is a row template over the option envelope, so `type`
 * comes from the route (`$param.type`) and `option` / `value` come from the row
 * (`$record.path`, `$record.value`). One declaration draws every row, which is
 * the same trade `specimen.subject.type` makes and the reason that field takes
 * the deferred forms too. A literal in all three is equally legal and is what an
 * ordinary app documenting its own kit would write.
 *
 * ## The drawn subject carries `data-design-preview-subject`
 *
 * Its value is the RESOLVED type, which is what lets a routed preview prove it
 * drew the type the path named. Deliberately not `data-design-specimen`: that
 * attribute is an AUTHORED prop the admin console puts on a wrapper of its own,
 * not engine output, so reusing it would tie this type's contract to one
 * consumer's config and leave a preview on an ordinary page carrying nothing.
 *
 * ## The write-path refusal is inherited, not restated
 *
 * A preview is a preview frame, so [internal ref] A3 clause 2 applies: a `form` may
 * not be drawn inside one, and neither may `specimen` or `preview` itself.
 * That test belongs where the catalogue is reachable —
 * `design-console-component-validation.ts`, which already runs the same test for
 * `specimen.subject.type` — rather than in a second copy here that could go
 * quiet on its own.
 *
 * Source: [internal ref]
 * Specs: [internal ref] … 006, plus this type's own REGRESSION rollup
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const PreviewTypeLiteral = Schema.Literal('preview')

/**
 * What a preview draws: a type, one of its options, and the value to set it to.
 *
 * All three are required. A preview missing any one of them has nothing to draw
 * and nothing to say — unlike `specimen`, whose axis fields are genuinely
 * optional because a type has a default variant, a default size and a resting
 * state, while no option has a "default option".
 */
const PreviewSubjectSchema = Schema.Struct({
  type: Schema.String.pipe(
    Schema.annotate({
      title: 'Subject Type',
      description:
        'The component type to draw. A catalogued type name; `$param.<name>` naming a segment of the host page’s path; or `$record.<field>` naming a column of the row this preview is expanded from.',
      examples: ['table', '$param.type'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  option: Schema.String.pipe(
    Schema.annotate({
      title: 'Option Path',
      description:
        'The option to set, in the path grammar `GET /api/admin/schema/component-types/:type/options` publishes — dotted, with `[]` for an array level. `$record.<field>` resolves it per row.',
      examples: ['pagination.position', 'columns[].format', '$record.path'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  /**
   * The value to set the option to.
   *
   * Three scalar shapes because that is what an option's own kind can be — an
   * enum member, a count, a flag. A string is coerced against the option's kind
   * at render, so a row template carrying `$record.value` (always a string off
   * the wire) draws the same thing a literal `2` would.
   *
   * A structured value is deliberately out: an option whose value is an object
   * is not one a reader learns from a single picture, and admitting one here
   * would make the caption unwritable.
   *
   * The empty string is deliberately IN, where `type` and `option` refuse it: a
   * real option's interesting value is sometimes `''` — an empty `placeholder`,
   * an empty `emptyText` — and a preview of it is the picture a reader most
   * needs. An empty `type` or `option` names nothing at all, which is a
   * different kind of emptiness.
   */
  value: Schema.Union([Schema.String, Schema.Finite, Schema.Boolean]).annotate({
    title: 'Option Value',
    description:
      'The value to set the option to. A string is coerced against the option’s own kind, so a `$record.value` row template and a literal draw the same thing.',
    examples: ['both', 2, true],
  }),
}).annotate({
  identifier: 'PreviewSubject',
  title: 'Preview Subject',
  description: 'The type, the option and the value a preview draws',
})

export const previewFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /** What is drawn. */
  subject: PreviewSubjectSchema,
  /**
   * The sentence under the drawing.
   *
   * Authored rather than generated: a schema `description` says what the option
   * IS, and what a reader needs beside the picture is what this VALUE does to
   * it. Omitted, the drawing stands alone — which is right for a value whose
   * effect is self-evident, and wrong often enough that the console's own
   * Configuration sections write one per row.
   */
  caption: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Caption',
        description:
          'One line under the drawing saying what this value does. Ordinary text, so `$record.<field>` resolves here.',
        examples: ['Pagers above and below, for a grid taller than the viewport.'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * Print the option and its value above the drawing.
   *
   * On by default in the reading a Configuration row wants — the row already
   * prints the path in its own left column, so the console turns it off there
   * and an app drawing a single preview on its own page leaves it on.
   */
  showValue: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Print `option: value` above the drawing (default: true). Turn it off where the surrounding layout already names the option.',
    })
  ),
} as const
