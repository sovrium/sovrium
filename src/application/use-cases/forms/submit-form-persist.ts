/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  buildSyntheticSession,
  buildSystemSession,
} from '@/application/use-cases/automations/build-guest-session'
import { coerceScalarsForArrayColumns } from '@/application/use-cases/forms/coerce-array-columns'
import { coerceEmptySelectToNull } from '@/application/use-cases/forms/coerce-empty-select'
import { reserveLedgerSlot, writeLedgerRow } from '@/application/use-cases/forms/submit-form-ledger'
import { storedRowOf } from '@/application/use-cases/tables/record-stored-row'
import { createRecordWithSideEffects } from '@/application/use-cases/tables/record-write-roads'
import { SYSTEM_USER_ID } from '@/domain/models/app/auth/guest-session'
import { buildCreateAuthorshipOverrides } from '@/domain/models/app/tables/authorship-fields'
import { coerceLinkedRecordId } from './submit-form-body'
import { filterTableBoundFields } from './submit-form-field-shaping'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
import type { SubmissionSurface } from '@/domain/models/app/forms/submission-ledger-service'

/**
 * Where an accepted submission is written: the bound table's record — through
 * the records API's one create path, so it fires the table's record-create
 * automations and create webhooks exactly as a records-API create does — and
 * the submission ledger.
 */

/** Outcome of {@link persistSubmission}: the IDs needed by the trigger + result. */
interface PersistOutcome {
  readonly submissionId: string | undefined
  readonly linkedRecordPresent: boolean
  readonly linkedRecordId: string | undefined
  /**
   * The bound-table row AS STORED — server stamps (`created-by`, `created-at`)
   * and column defaults included — which its record automations receive.
   */
  readonly linkedRecordFields?: Readonly<Record<string, unknown>>
}

/**
 * Persist a processed submission: reserve the cap slot (capped forms), write
 * the bound-table row (when `submitTo.table` is set), then write the ledger
 * row (skipped when the cap path already reserved it). Extracted from
 * `submitFormProgram` to keep the orchestrator under the complexity cap.
 */
/**
 * Write the bound-table row for a submission (when `submitTo.table` is set).
 *
 * Y-5 follow-up: native HTML `<select>` widgets always submit a scalar even
 * for `multi-select` columns (PostgreSQL `text[]`); the scalar values for
 * array-typed columns are coerced into single-element arrays so the SQL insert
 * receives the shape `buildInsertClauses` expects.
 *
 * Authorship: an authenticated submission is authored by the REAL submitter —
 * it writes with the submitter's session AND stamps every `created-by`-typed
 * column (the literal `created_by` AND any custom-named one, e.g. `author`) by
 * name (the infra injection only fills the literal columns).
 *
 * An anonymous submission has no submitter to name, so it is authored by the
 * system actor: it writes with the system session and stamps every
 * `created-by` column (literal or custom-named) with `SYSTEM_USER_ID` — the
 * same value an automation-authored create writes. Authorship columns carry no
 * foreign key to the user table, so the sentinel is valid there; the
 * activity-log row's user foreign key still resolves it to NULL
 * (`resolveActorUserId`).
 */
const writeBoundTableRecord = (input: {
  readonly app: Readonly<App>
  readonly form: Readonly<Form>
  readonly mapped: Readonly<Record<string, unknown>>
  readonly submitterUserId: string | undefined
  readonly processEnv: Readonly<Record<string, string | undefined>>
}) =>
  Effect.gen(function* () {
    const { app, form, mapped, submitterUserId } = input
    if (form.submitTo.table === undefined) return undefined
    const tableName = form.submitTo.table
    // The form writes with its own authority (no caller role judges the echo),
    // as its submitter or, for a signed-out visitor, as the system — which is
    // also who its record automations run for.
    const session =
      submitterUserId !== undefined ? buildSyntheticSession(submitterUserId) : buildSystemSession()
    return yield* createRecordWithSideEffects({
      // `app` resolves the bound table's many-to-many fields, split out of the
      // base insert and written as junction rows against the resolved id —
      // otherwise a form filing an m2m field fails with `column ... does not
      // exist`, on plain AND view-backed tables.
      app,
      session,
      tableName,
      // As before the form took this road: no SQLite AI baseline merge here.
      isSqlite: false,
      processEnv: input.processEnv,
      // A record automation reads the answers no column stores, beneath the
      // row as stored — the stamps and the defaults included.
      triggerValues: mapped,
      fields: {
        // Order matters: `''` becomes `null` FIRST, so the array coercion
        // below sees an absent value and passes it through rather than
        // wrapping it into `['']` — which the option CHECK constraint would
        // reject just as surely as the bare `''`.
        ...coerceScalarsForArrayColumns(
          coerceEmptySelectToNull(filterTableBoundFields(mapped, form), app, tableName),
          app,
          tableName
        ),
        ...buildCreateAuthorshipOverrides(app.tables, tableName, submitterUserId ?? SYSTEM_USER_ID),
      },
    })
  })

export const persistSubmission = (input: {
  readonly app: Readonly<App>
  readonly form: Readonly<Form>
  readonly surface: SubmissionSurface
  readonly mapped: Readonly<Record<string, unknown>>
  readonly submitterIpHash: string | undefined
  readonly userAgent: string | undefined
  readonly submitterUserId: string | undefined
  readonly processEnv: Readonly<Record<string, string | undefined>>
}) =>
  Effect.gen(function* () {
    const { app, form, mapped, submitterIpHash, userAgent, submitterUserId } = input
    // Reserve the cap slot atomically BEFORE the
    // bound-table write so the counted-status ledger rows never exceed the
    // cap, even under concurrency. A failed reservation fails fast and never
    // touches the bound table.
    const cappedSubmissionId =
      form.availability?.maxSubmissions !== undefined
        ? yield* reserveLedgerSlot({
            form,
            mapped,
            maxSubmissions: form.availability.maxSubmissions,
            submitterIpHash,
            userAgent,
            submitterUserId,
          })
        : undefined

    const linkedRecord = yield* writeBoundTableRecord({
      ...{ app, form, mapped, submitterUserId },
      processEnv: input.processEnv,
    })
    const linkedRecordId = coerceLinkedRecordId(linkedRecord)

    // Capped forms already reserved their ledger row above; the standard
    // write is skipped to avoid a duplicate row.
    const submissionId =
      cappedSubmissionId ??
      (yield* writeLedgerRow({
        form,
        surface: input.surface,
        mapped,
        linkedRecordId,
        submitterIpHash,
        userAgent,
        submitterUserId,
      }))

    return {
      submissionId,
      linkedRecordPresent: linkedRecord !== undefined,
      linkedRecordId,
      ...(linkedRecord !== undefined && { linkedRecordFields: storedRowOf(linkedRecord) }),
    } satisfies PersistOutcome
  }).pipe(Effect.withSpan('forms.persist-submission', { attributes: { form: input.form.name } }))
