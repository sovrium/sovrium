/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const SubmitToSchema = Schema.Struct({
  table: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({
        description: 'Name of the table to persist the submission record in',
      })
    )
  ),

  automation: Schema.optional(
    Schema.String.pipe(
      Schema.pattern(/^[a-z][a-z0-9-]*$/),
      Schema.maxLength(100),
      Schema.annotations({
        description: 'Name of the automation to invoke on submission',
      })
    )
  ),

  mapping: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String }).annotations({
      description: 'Map form field names to destination column names',
    })
  ),

  storeSubmission: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Persist submission in the built-in form_submissions ledger. Default true.',
    })
  ),
}).pipe(
  Schema.filter((s) =>
    s.table !== undefined || s.automation !== undefined || s.storeSubmission !== false
      ? true
      : 'submitTo must specify at least one of: table, automation, storeSubmission: true'
  ),
  Schema.annotations({
    identifier: 'SubmitTo',
    title: 'Submit-To Destination',
    description:
      'Where a form submission is persisted and/or routed. At least one of table, automation, or storeSubmission: true must be set.',
  })
)

export type SubmitTo = Schema.Schema.Type<typeof SubmitToSchema>
