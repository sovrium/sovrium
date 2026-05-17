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
      Schema.annotations({
        description: 'ISO 8601 timestamp at which the form opens for submissions',
      })
    )
  ),
  /** ISO 8601 timestamp at which the form stops accepting submissions. */
  closesAt: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'ISO 8601 timestamp at which the form closes',
      })
    )
  ),
  /**
   * Hard cap on the number of submissions accepted. The (count + 1)-th
   * submission is rejected with a clear "form closed" message.
   */
  maxSubmissions: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({
        description: 'Maximum number of submissions accepted before the form auto-closes',
      })
    )
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

/** @public */
export type FormAvailability = Schema.Schema.Type<typeof FormAvailabilitySchema>
