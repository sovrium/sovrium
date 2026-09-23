/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Submit-To Destination
 *
 * Where a form submission is persisted and/or routed. Decouples the form
 * definition from any one persistence model — the same form can write to a
 * table, fire an automation, store in the built-in submission ledger, or any
 * combination.
 *
 * Cross-validation: at least one of `table`, `automation`, or
 * `storeSubmission: true` (the default) must be specified — otherwise the
 * submission would be discarded silently.
 *
 * `submitTo.table` and `submitTo.automation` references are validated against
 * the app's `tables[]` and `automations[]` arrays respectively in
 * `AppSchema`-level cross-validation filters.
 *
 * @example
 * ```yaml
 * submitTo:
 *   table: leads
 * ```
 *
 * @example
 * ```yaml
 * submitTo:
 *   automation: notify-sales
 *   storeSubmission: true   # default
 * ```
 *
 * @example
 * ```yaml
 * submitTo:
 *   table: support_tickets
 *   automation: page-on-call
 *   mapping:
 *     userEmail: email   # form field 'userEmail' -> table column 'email'
 * ```
 */
export const SubmitToSchema = Schema.Struct({
  /** Persist submission as a record in this table. References `tables[].name`. */
  table: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'Name of the table to persist the submission record in',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),

  /** Trigger this automation on submit. References `automations[].name`. */
  automation: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'Name of the automation to invoke on submission',
      }),
      Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/), Schema.isMaxLength(100))
    )
  ),

  /**
   * Field-to-column mapping. Defaults to identity (form field name = table
   * column name). Use when form field names diverge from table column names.
   */
  mapping: Schema.optional(
    Schema.Record(Schema.String, Schema.String).annotate({
      defaultNote: 'identity — each form field writes to the table column of the same name',
      description: 'Map form field names to destination column names',
    })
  ),

  /**
   * Store the submission in the built-in `form_submissions` ledger for the
   * Forms Responses admin view. Default `true` — opt out with `false`.
   */
  storeSubmission: Schema.optional(
    Schema.Boolean.annotate({
      defaultNote: 'true',
      description: 'Persist submission in the built-in form_submissions ledger. Default true.',
    })
  ),
})
  .annotate({
    // Before the checks: see the note in `forms/path.ts` — a description piped
    // after a `makeFilter` check is dropped from the published JSON Schema.
    description:
      'Where a submission goes: a table row, an automation run, the built-in submission ledger, or any combination of the three. At least one is required.',
  })
  .pipe(
    Schema.check(
      Schema.makeFilter((s) =>
        s.table !== undefined || s.automation !== undefined || s.storeSubmission !== false
          ? true
          : 'submitTo must specify at least one of: table, automation, storeSubmission: true'
      )
    ),
    Schema.annotate({
      identifier: 'SubmitTo',
      title: 'Submit-To Destination',
      description:
        'Where a form submission is persisted and/or routed. At least one of table, automation, or storeSubmission: true must be set.',
    })
  )

/** @public */
export type SubmitTo = Schema.Schema.Type<typeof SubmitToSchema>
