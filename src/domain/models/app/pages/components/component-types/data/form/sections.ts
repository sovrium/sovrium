/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * One titled section of a page `form` — a heading, an optional line of
 * guidance, and the fields drawn under it, in order.
 *
 * ─── LAYOUT ONLY, ON PURPOSE ──────────────────────────────────────────────
 *
 * A page form WORKS ON DATA ALREADY IN THE APP: it edits the record a page
 * shows, or posts to an endpoint of the author's own. A long edit form still
 * needs structure — "Identity", "Billing", "Preferences" — so the author can
 * find the field they came for. `sections` gives it exactly that and nothing
 * else: no condition, no step, no collapsing, no validation scope. Every field
 * is in the DOM and submitted whatever section it sits in.
 *
 * Conditional fields and multi-step layouts belong to a form that TAKES
 * SOMETHING IN, a top-level `forms[]` entry, which already groups its fields
 * with `forms[].fieldGroups`. A section that could hide its fields would be a
 * second, weaker copy of that, so the two keys stay apart: `sections` here,
 * `fieldGroups` there.
 *
 * ─── WHAT A SECTION MAY NAME ──────────────────────────────────────────────
 *
 * Each name in `fields` is a field the form draws: an entry of the form's
 * `fields[]` when it declares one, otherwise a column of the bound table. A
 * name the form does not draw, or a name listed in two sections, is refused
 * when the config loads, naming the section and the field. A field listed in
 * no section is drawn after the last section, in the form's own order — so
 * sectioning the first fields of a form never loses the rest.
 *
 * @example
 * ```yaml
 * - type: form
 *   dataSource: { table: clients, mode: single }
 *   action: { type: crud, operation: update, table: clients }
 *   sections:
 *     - title: Identity
 *       fields: [company_name, siret]
 *     - title: Billing
 *       description: Where invoices are sent.
 *       fields: [billing_email, billing_address]
 * ```
 */
export const FormSectionSchema = Schema.Struct({
  title: Schema.String.pipe(
    Schema.annotate({
      description: 'Heading drawn above the fields of the section',
      examples: ['Identity', 'Billing'],
    }),
    Schema.check(Schema.isNonEmpty({ message: 'a section title must not be empty' }))
  ),
  description: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'One line of guidance drawn under the heading',
        examples: ['Where invoices are sent.'],
      }),
      Schema.check(Schema.isNonEmpty({ message: 'a section description must not be empty' }))
    )
  ),
  fields: Schema.NonEmptyArray(
    Schema.String.annotate({ description: 'A field name, as the form draws it' })
  ).pipe(
    Schema.annotate({
      description:
        "The fields drawn in this section, in order: entries of the form's `fields[]`, or columns of the bound table when the form declares no `fields[]`. Each field may sit in one section only.",
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'FormSection',
    title: 'Form Section',
    description:
      'A titled group of fields on a page form: a heading, an optional line of guidance, and the fields drawn under it. Layout only — every field is shown and submitted.',
  })
)

/**
 * The ordered sections of a page form. Fields listed in no section are drawn
 * after the last one.
 */
export const FormSectionsSchema = Schema.Array(FormSectionSchema).pipe(
  Schema.annotate({
    description:
      'Titled groups of fields, drawn in order. Layout only: no condition, no step — every field is shown and submitted. A field in no section is drawn after the last section. Each listed field must be one the form draws, and may sit in one section only.',
  }),
  Schema.check(Schema.isMinLength(1))
)

/** @public Public type surface of the form sections schema. */
export type FormSection = Schema.Schema.Type<typeof FormSectionSchema>
