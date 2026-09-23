/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Form Availability
 *
 * Controls when a form accepts submissions. All fields are optional — by
 * default a form is always open and unlimited.
 *
 * Cross-field rule: when both `opensAt` and `closesAt` are set, `opensAt`
 * must be strictly before `closesAt`.
 */
export const FormAvailabilitySchema = Schema.Struct({
  /** ISO 8601 timestamp at which the form starts accepting submissions. */
  opensAt: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'ISO 8601 timestamp at which the form opens for submissions',
      })
    )
  ),
  /** ISO 8601 timestamp at which the form stops accepting submissions. */
  closesAt: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'ISO 8601 timestamp at which the form closes',
      })
    )
  ),
  /**
   * Hard cap on the number of submissions accepted. The (count + 1)-th
   * submission is rejected with a clear "form closed" message.
   */
  maxSubmissions: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description: 'Maximum number of submissions accepted before the form auto-closes',
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
  /**
   * Optional custom UI rendered when the form is closed (before `opensAt`,
   * after `closesAt`, or past `maxSubmissions`). When omitted the renderer
   * falls back to the form title + default boilerplate copy.
   */
  closedPage: Schema.optional(
    Schema.Struct({
      type: Schema.optional(
        Schema.Literal('page').annotate({
          description:
            'How a closed form answers. `page` — the only shape — draws the notice below in place of the form.',
        })
      ),
      title: Schema.optional(
        Schema.String.annotate({
          description: 'Heading shown to a visitor who arrives while the form is closed.',
        }).pipe(Schema.check(Schema.isMinLength(1)))
      ),
      message: Schema.optional(
        Schema.String.annotate({
          description: 'Text explaining why the form is closed, and what to do instead.',
        })
      ),
      cta: Schema.optional(
        Schema.Struct({
          label: Schema.String.annotate({
            description: 'Text of the link offered on the closed-form page.',
          }).pipe(Schema.check(Schema.isMinLength(1))),
          href: Schema.String.annotate({
            description: 'Where that link goes.',
          }).pipe(Schema.check(Schema.isMinLength(1))),
        }).annotate({
          description:
            'An optional link offered to a visitor who arrives while the form is closed.',
        })
      ),
    }).annotate({
      description: 'Custom closed-form UI block (title, message, optional CTA link)',
    })
  ),
})
  .annotate({
    // Before the checks: see the note in `forms/path.ts`.
    description:
      'When the form accepts answers: an opening date, a closing date, a cap on the number of submissions, and what to show once it is closed.',
  })
  .pipe(
    Schema.check(
      Schema.makeFilter((a) => {
        if (a.opensAt && a.closesAt) {
          const open = Date.parse(a.opensAt)
          const close = Date.parse(a.closesAt)
          if (Number.isNaN(open) || Number.isNaN(close)) {
            return 'opensAt and closesAt must be valid ISO 8601 timestamps'
          }
          if (open >= close) {
            return `opensAt (${a.opensAt}) must be strictly before closesAt (${a.closesAt})`
          }
        }
        return true
      })
    ),
    Schema.annotate({
      identifier: 'FormAvailability',
      title: 'Form Availability',
      description: 'Controls when a form accepts submissions (opensAt / closesAt / maxSubmissions)',
    })
  )

/** @public */
export type FormAvailability = Schema.Schema.Type<typeof FormAvailabilitySchema>
