/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Submitter Options
 *
 * Per-form options that govern how submitters interact with the form across
 * multiple sessions: save-and-resume, edit-after-submit, and uniqueness rules.
 */
export const SubmitterOptionsSchema = Schema.Struct({
  /**
   * When true, submitters can save partial progress; anonymous submitters
   * receive an emailed token URL, authenticated submitters resume automatically.
   */
  saveAndResume: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Allow submitters to save partial progress and resume later',
    })
  ),
  /** When true, submitters can edit their submission after submitting. */
  allowEditAfterSubmit: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Allow submitters to edit their submission after the initial submit',
    })
  ),
  /**
   * When true, the form rejects a submission if the same submitter (auth user
   * or anon device fingerprint) has already submitted.
   */
  requireUniqueSubmission: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Reject duplicate submissions from the same submitter',
    })
  ),
}).annotations({
  identifier: 'SubmitterOptions',
  title: 'Submitter Options',
  description: 'Per-form save-and-resume, edit-after-submit, and uniqueness rules',
})

/** @public */
export type SubmitterOptions = Schema.Schema.Type<typeof SubmitterOptionsSchema>
