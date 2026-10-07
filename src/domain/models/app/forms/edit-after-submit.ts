/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Form Edit After Submit
 *
 * Gives the submitter a private edit link after a successful submission. The
 * link reopens the form filled with the submitted answers, and saving it
 * updates the same submission (and the row it wrote to `submitTo.table`)
 * instead of creating a new one. The link stops working once `window` has
 * passed since the submission. Every edit is written to the activity log with
 * the fields it changed.
 */
export const FormEditAfterSubmitSchema = Schema.Struct({
  window: Schema.String.pipe(
    Schema.annotate({
      description:
        'How long after submitting the submitter may still change their answers, as a number followed by m (minutes), h (hours) or d (days), e.g. "30m", "24h" or "7d". The edit link is refused once this time has passed.',
    }),
    Schema.check(Schema.isPattern(/^\d+\s*(m|h|d)$/))
  ),
}).annotate({
  identifier: 'FormEditAfterSubmit',
  title: 'Form Edit After Submit',
  description:
    'A time-limited private link letting the submitter change a submission they already sent.',
})

/** @public */
export type FormEditAfterSubmit = Schema.Schema.Type<typeof FormEditAfterSubmitSchema>
