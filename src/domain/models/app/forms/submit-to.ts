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
 * `storeSubmission` not `false` must hold — otherwise the submission would be
 * discarded silently. (Through a `formRef` embed an omitted `storeSubmission`
 * does not store; such a form still needs `table` or `automation` to keep
 * anything from an embedded submission, which `submitTo.table` gives every
 * in-app create form.)
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
 *   storeSubmission: true   # also store submissions made through a formRef embed
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
   * Store the submission in the built-in `form_submissions` ledger read by the
   * console's Submissions inbox.
   *
   * ONE KEY, READ BY SURFACE. Omitted, it means "store" for a submission made
   * on the form's own route and "do not store" for one made through a
   * `formRef` embed on an app page — an in-app "new task" form is an ordinary
   * edit, not an intake to triage. `true` stores on both surfaces; `false`
   * stores on neither. A second key was rejected: one key read by surface is
   * one fewer thing to learn, at the cost of "omitted" having two meanings,
   * which the description states once.
   *
   * THE CAP EXCEPTION. A form declaring `availability.maxSubmissions` writes
   * its row on every surface whatever this key says, because the cap is
   * counted by reserving that row.
   */
  storeSubmission: Schema.optional(
    Schema.Boolean.annotate({
      defaultNote:
        'true on the form’s own route; false for a submission made through a `formRef` embed on an app page',
      description:
        'Write the submission to the built-in submission ledger (the console’s Submissions inbox). Omitted, the form’s own route stores it and a `formRef` embed on an app page does not; `true` stores on both, `false` on neither. A form with `availability.maxSubmissions` stores on every surface, because the cap is counted in the ledger.',
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
