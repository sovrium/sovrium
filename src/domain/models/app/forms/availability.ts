/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const FormAvailabilitySchema = Schema.Struct({
  opensAt: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'ISO 8601 timestamp at which the form opens for submissions',
      })
    )
  ),
  closesAt: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'ISO 8601 timestamp at which the form closes',
      })
    )
  ),
  maxSubmissions: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({
        description: 'Maximum number of submissions accepted before the form auto-closes',
      })
    )
  ),
  closedPage: Schema.optional(
    Schema.Struct({
      type: Schema.optional(Schema.Literal('page')),
      title: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
      message: Schema.optional(Schema.String),
      cta: Schema.optional(
        Schema.Struct({
          label: Schema.String.pipe(Schema.minLength(1)),
          href: Schema.String.pipe(Schema.minLength(1)),
        })
      ),
    }).annotations({
      description: 'Custom closed-form UI block (title, message, optional CTA link)',
    })
  ),
}).pipe(
  Schema.filter((a) => {
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
  }),
  Schema.annotations({
    identifier: 'FormAvailability',
    title: 'Form Availability',
    description: 'Controls when a form accepts submissions (opensAt / closesAt / maxSubmissions)',
  })
)

export type FormAvailability = Schema.Schema.Type<typeof FormAvailabilitySchema>
