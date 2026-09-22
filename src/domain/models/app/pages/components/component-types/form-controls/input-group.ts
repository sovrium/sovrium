/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `input-group` — an input with a leading addon, a trailing addon, or an
 * attached control.
 *
 * ## Why it is not a prop on `input`
 *
 * An addon is not decoration on the box, it CHANGES the box: the input loses
 * the border it shares with the addon and half its corner radius, and the two
 * elements have to agree on a single height and a single focus ring or the seam
 * shows. Every one of those is a rule about the PAIR. Expressing it as
 * `input.prefix` would put the pair's rules inside the shape of one of its
 * halves, and every renderer touching `input` would have to know about them.
 *
 * ## The three slots are the three shapes, and they compose
 *
 * `prefix` (a unit, a currency, a scheme), `suffix` (a unit, a domain), and
 * `action` (an attached control at the end). Declaring more than one is legal
 * and draws them in that order — an author writing `https://` before and
 * `Check` after is not doing anything the seam rules do not already cover.
 *
 * ## The addons are text and the action is a link
 *
 * Addons are inert by construction, which is what lets them be plain strings: a
 * unit label has no behaviour to declare. The action is a LINK with a required
 * `href` for the reason `description-list` states at more length — a control
 * that visibly does nothing is worse than no control, and a clipboard action
 * would need the delegated copy runtime, which is scoped to code blocks.
 *
 * Source: [internal ref]
 * Specs: [internal ref] … 005, plus this type's own REGRESSION rollup
 */

import { Schema } from 'effect'
import { InputTypeSchema } from '../../form-controls'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const InputGroupTypeLiteral = Schema.Literal('input-group')

/** The control attached to the end of the group. */
const InputGroupActionSchema = Schema.Struct({
  label: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      title: 'Action Label',
      description: 'Visible text of the attached control',
      examples: ['Browse', 'Check'],
    })
  ),
  href: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      title: 'Action Target',
      description:
        'Where the control goes. Required: an attached control with nowhere to go is a control that does nothing.',
      examples: ['/records/invoices'],
    })
  ),
}).annotate({
  identifier: 'InputGroupAction',
  title: 'Attached Control',
  description: 'A link drawn attached to the trailing edge of the input',
})

export const inputGroupFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /** Label above the group. */
  label: Schema.optional(
    Schema.String.annotate({
      description:
        'Label above the group. Bound to the input itself, not to the addons — an addon is not a control and must not be what a screen reader announces as the field.',
      examples: ['Amount'],
    })
  ),
  /** Form field name of the inner input. */
  name: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        description: 'Form field name of the inner input — what a submitted value is keyed by',
        examples: ['amount'],
      })
    )
  ),
  /** HTML type of the inner input. */
  inputType: Schema.optional(InputTypeSchema),
  /** Placeholder of the inner input. */
  placeholder: Schema.optional(
    Schema.String.annotate({ description: 'Placeholder text of the inner input' })
  ),
  /** Initial value of the inner input. */
  value: Schema.optional(
    Schema.String.annotate({
      description:
        'Initial value of the inner input. Ordinary text, so `$record.<field>` resolves here.',
      examples: ['4,120.00', '$record.amount'],
    })
  ),
  /**
   * Text in the leading addon.
   *
   * A unit, a currency, a URL scheme — something that qualifies the value
   * without being part of it. It is never submitted: the addon sits outside the
   * `<input>`, so a `€` prefix does not end up in the record.
   */
  prefix: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        title: 'Leading Addon',
        description:
          'Text in the leading addon — a currency, a scheme, a unit. Outside the input, so it is never part of the submitted value.',
        examples: ['€', 'https://'],
      })
    )
  ),
  /** Text in the trailing addon, on the same terms as `prefix`. */
  suffix: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        title: 'Trailing Addon',
        description:
          'Text in the trailing addon — a unit, a domain, a percent sign. Outside the input, so it is never part of the submitted value.',
        examples: ['kg', '.sovrium.com'],
      })
    )
  ),
  action: Schema.optional(InputGroupActionSchema),
} as const
