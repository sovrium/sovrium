/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const SubmitterOptionsSchema = Schema.Struct({
  saveAndResume: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Allow submitters to save partial progress and resume later',
    })
  ),
  allowEditAfterSubmit: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Allow submitters to edit their submission after the initial submit',
    })
  ),
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

export type SubmitterOptions = Schema.Schema.Type<typeof SubmitterOptionsSchema>
