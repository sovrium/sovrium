/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

/**
 * Field-specimen page-component
 *
 * Draws the control a FIELD type gets — one table column type, rendered as the
 * form control an author's record form will actually show for it.
 *
 * ─── WHY THIS IS NOT A SECOND VOCABULARY ON `specimen` ────────────────────
 *
 * `specimen` draws a COMPONENT and prints the config literal that produced it.
 * A field type has neither: no component, no config literal, no variant axis,
 * no size axis, and no state vocabulary. Folding it into `specimen.subject`
 * would put four permanently meaningless members on that node — `variant`,
 * `size`, `state`, and the whole `annotations` part-vocabulary — make `type`
 * optional so a second XOR could exclude it, and need three decode rules to say
 * that half the struct is unreachable in one of its two modes.
 *
 * They are two different questions and this is the second one, so it is its own
 * type — the second published specimen, beside `specimen` itself.
 *
 * ─── IT DECODES INTO A DESCRIPTOR THAT ALREADY EXISTS ─────────────────────
 *
 * `domain/models/app/design/field-specimen.ts` already defines this shape, and
 * `presentation/rendering/field-specimen-resolver.ts` already expands it at
 * render time into the crud-form island's own control. That descriptor is
 * deliberately UNDECODABLE — synthesized after decode, never written by an
 * author — because it was built when the console was a set of code builders and
 * its vocabulary was private to them.
 *
 * The console is config now, so its vocabulary has to be public: this schema is
 * that descriptor's decodable face, and the renderer keeps ONE expansion path.
 * Not a second table — one shape with two faces.
 *
 * ─── AND IT IS GENUINELY AN OPERATOR'S TOOL, NOT ONLY THE CONSOLE'S ───────
 *
 * "Show my readers what a `single-select` looks like before they fill the form"
 * is documentation any app might want. That is why this type survived the
 * catalogue reshape as a PUBLIC one rather than being folded away with the
 * console-only primitives it once sat beside: an app documenting its own data
 * model needs it, and Sovrium's console is its first consumer rather than its
 * owner.
 *
 * ─── THE ANCHOR RULE, WHICH IS LOAD-BEARING ───────────────────────────────
 *
 * `name` is the element a comparison is anchored on, because for `rich-text`
 * the first DESCENDANT control is a `div[role=status]` placeholder rather than
 * the hidden mirror input that carries the name. Anchoring on the wrapper
 * compares two different elements as if they were one.
 *
 * It is OPTIONAL here and defaults to the field type with its hyphens replaced
 * by underscores — `FieldNameSchema` rejects a hyphen outright, so the two are
 * not derivable from one another by a reader, and a config page has no string
 * operations with which to derive one. The default is deterministic and is what
 * a caller would have chosen, so a specimen and the real form it documents
 * agree on the anchor without either side writing it down.
 *
 * ─── WHAT IT DOES NOT CARRY, AND WHY ──────────────────────────────────────
 *
 * There is no `surface` field. The descriptor names which of the three
 * field-drawing surfaces a specimen documents, and there is exactly ONE member
 * today (`crud-form-island`); a single-member union is a public contract
 * offering no choice, and publishing it would ask every author to spell a
 * constant. The renderer supplies it, and the field appears here on the day a
 * second surface does.
 *
 * There is no `fullWidth` either. Whether a control spans both columns of a
 * form is layout, and layout belongs to the page that composes it — a
 * `container` with the right classes around the specimen — not to a fact about
 * the field type.
 *
 * Source: [internal ref]
 * Specs: [internal ref] … 031
 */
export const FieldSpecimenTypeLiteral = Schema.Literal('field-specimen')

export const fieldSpecimenFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /**
   * The field type to draw.
   *
   * A plain refined string rather than a union of the catalogued literals, for
   * the reason `specimen.subject.type` is one: the union is built from the
   * per-category barrels and importing it back here closes a cycle, and the
   * embedded config-type declaration types a page component as `any` anyway, so
   * a `.ts` config gets no autocomplete from it either way.
   *
   * Membership is checked where the catalogue IS reachable, in
   * `design-console-component-validation.ts`, which can also say WHICH type was
   * meant and why it was refused — a union member mismatch cannot.
   */
  fieldType: Schema.String.pipe(
    Schema.annotate({
      title: 'Field Type',
      description:
        'The table field type to draw a control for. A catalogued field-type name; `$param.<name>` naming a segment of the host page’s path; or `$record.<field>` naming a column of the row this specimen is expanded from, which requires a record-binding ancestor.',
      examples: ['long-text', 'single-select', '$record.type'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  /**
   * The `name` the drawn control carries — the comparison anchor.
   *
   * Defaults to the field type with hyphens replaced by underscores. See the
   * anchor rule in the module header for why it exists at all.
   */
  name: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Control Name',
        description:
          'The `name` attribute the drawn control carries — the element a comparison against a real form is anchored on. Defaults to the field type with hyphens replaced by underscores, which is what `FieldNameSchema` accepts.',
        examples: ['long_text'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /** Visible label on the control. Falls back to the humanised name. */
  label: Schema.optional(
    Schema.String.annotate({
      description: 'Visible label on the drawn control (default: the humanised control name)',
    })
  ),
  /**
   * Option values for choice-shaped types.
   *
   * Absent renders an empty control, which is honest rather than helpful: a
   * `single-select` with no options IS what an author gets if they declare none.
   */
  options: Schema.optional(
    Schema.Array(
      Schema.String.annotate({ description: 'One option value the drawn control offers' })
    ).annotate({
      description:
        'Option values for a choice-shaped field type. Absent draws the empty control — which is what an author who declares no options actually gets.',
      examples: [['Draft', 'Sent', 'Paid']],
    })
  ),
  /** Placeholder text inside the control. */
  placeholder: Schema.optional(
    Schema.String.annotate({ description: 'Placeholder text inside the drawn control' })
  ),
  /** Helper text under the control. */
  description: Schema.optional(
    Schema.String.annotate({ description: 'Helper text under the drawn control' })
  ),
  /**
   * An illustrative value in the control.
   *
   * Empty by default: a specimen documents the CONTROL, not a record, and a
   * pre-filled one teaches a reader what someone once typed.
   */
  value: Schema.optional(
    Schema.String.annotate({
      description:
        'An illustrative value in the drawn control. Empty by default — a specimen documents the control, not a record.',
    })
  ),
  /**
   * Suppress the per-specimen caption naming which surface this documents.
   *
   * The caption is load-bearing where one control stands alone: without it the
   * page asserts that this is THE rendering of the field type, which the
   * existence of three differing surfaces disproves. In a composed form drawing
   * every type at once the same sentence is stated ONCE above the form, and
   * repeating it under every control would bury the form in one paragraph
   * repeated dozens of times.
   *
   * It never suppresses the honesty of a DEFERRED control, which reports its
   * fidelity on the wrapper either way.
   */
  compact: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Suppress this control’s own surface caption, for a form that states it once above the whole group. Never suppresses the deferred-fidelity marker.',
    })
  ),
} as const
