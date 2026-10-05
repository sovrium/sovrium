/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The records API's payload rules, run for the MCP write tools.
 *
 * A write tool is the records API's write over another transport, so it owes
 * the same contract — and the only way to keep owing it is to run the SAME
 * compositions rather than a list of them kept here. Before this seam the
 * create tool ran three of the create chain's rules and the update tool
 * skipped the field-condition lock, so a caller refused a value over REST
 * (a missing required field, a foreign attachment key, a record a condition
 * had locked) wrote it through MCP.
 *
 *  - create: `validateRecordCreation` — readonly and computed columns,
 *    field-write permission, slug, required fields, formats, `multi-select`,
 *    `maxLinked`, attachment references and constraints, inline uploads and
 *    rich-text sanitising.
 *  - update: the field-condition lock on the stored row, the engine-managed
 *    columns, then `checkRecordUpdateValues` and rich-text sanitising — what
 *    `PATCH /api/tables/:t/records/:id` runs after its gates.
 *
 * Every refusal is thrown as a JSON-RPC error carrying the records API's own
 * sentence; nothing of a stored row is echoed.
 */

import { Effect } from 'effect'
import { rawGetRecordProgram } from '@/application/use-cases/tables/read-record-programs'
import { isRecordReadOnly } from '@/domain/models/app/tables/field-condition-evaluator-service'
import { provideTableLive } from '@/infrastructure/layers/table-layer'
import { runOnDomain } from '@/infrastructure/logging/request-effect'
import {
  createValidationLayer,
  type FieldFormatError,
  type FieldPermissionError,
  type FieldStorageError,
  type FieldValidationError,
} from '@/presentation/api/middleware/validation'
import {
  checkRecordUpdateValues,
  findReadonlyUpdateField,
  sanitizeRichTextFields,
  validateRecordCreation,
} from '@/presentation/api/tables/record-rules'
import { toolFailure } from './tool-call-helpers'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { App, Table } from '@/domain/models/app'
import type { DomainContext } from '@/infrastructure/logging/request-effect'

type WriteRuleError =
  FieldValidationError | FieldFormatError | FieldPermissionError | FieldStorageError

export interface WriteRuleInput {
  readonly app: App
  readonly table: Table
  /** The caller's account role — the one the records API's rules are keyed on. */
  readonly userRole: string
  /** The caller's groups: the read half of the field write rule matches them. */
  readonly userGroups: readonly string[]
  /** The caller is a visitor who is not signed in (her session's identity says so). */
  readonly signedOut: boolean
  readonly domainContext: DomainContext
}

/**
 * A refused payload as a JSON-RPC error, in the records API's words: a value
 * the rules refuse is invalid params; a field-permission refusal is its
 * anti-enumeration `Resource not found`; storage that could not answer is an
 * internal error whose sentence names no value.
 */
const failWith = (error: WriteRuleError): never => {
  if (error._tag === 'FieldPermissionError') return toolFailure(-32_603, 'Resource not found')
  if (error._tag === 'FieldStorageError') return toolFailure(-32_603, error.message)
  return toolFailure(-32_602, error.message)
}

/** A rule program the domain runtime can run (it provides storage). */
type RuleProgram = Parameters<typeof runOnDomain<Record<string, unknown>, WriteRuleError>>[1]

const runRules = async (
  input: WriteRuleInput,
  program: RuleProgram
): Promise<Record<string, unknown>> => {
  const outcome = await runOnDomain(input.domainContext, Effect.result(program))
  return outcome._tag === 'Failure' ? failWith(outcome.failure) : outcome.success
}

/** The values a create writes, after the records API's whole create chain. */
export const applyCreateRules = (
  input: WriteRuleInput,
  fields: Readonly<Record<string, unknown>>
): Promise<Record<string, unknown>> =>
  runRules(
    input,
    validateRecordCreation({ ...fields }).pipe(
      Effect.provide(
        createValidationLayer(input.app, input.table.name, {
          role: input.userRole,
          groups: input.userGroups,
          signedOut: input.signedOut,
        })
      )
    )
  )

/** The values an update writes, after the records API's per-value update rules. */
export const applyUpdateRules = (
  input: WriteRuleInput,
  fields: Readonly<Record<string, unknown>>
): Promise<Record<string, unknown>> => {
  const readonlyField = findReadonlyUpdateField(fields)
  if (readonlyField !== undefined) {
    return toolFailure(-32_602, `Cannot write to readonly field '${readonlyField}'`)
  }
  const values = { ...fields }
  return runRules(
    input,
    checkRecordUpdateValues(values).pipe(
      Effect.andThen(sanitizeRichTextFields(values)),
      Effect.provide(
        createValidationLayer(input.app, input.table.name, {
          role: input.userRole,
          groups: input.userGroups,
          signedOut: input.signedOut,
        })
      )
    )
  )
}

/**
 * Refuse an update of a record a field `condition` has locked (`readOnly`),
 * judged on the row as it stands — the records API's 400, as invalid params.
 * Runs after the row-level gate, so a caller who may not reach the row learns
 * nothing from the lock.
 */
export const refuseLockedRecord = async (
  table: Table,
  session: UserSession,
  recordId: string,
  app: App
): Promise<void> => {
  const hasConditions = table.fields.some(
    (field) =>
      'conditions' in field && Array.isArray(field.conditions) && field.conditions.length > 0
  )
  if (!hasConditions) return
  const fetched = await Effect.runPromise(
    Effect.result(provideTableLive(rawGetRecordProgram(session, table.name, recordId, app)))
  )
  if (fetched._tag === 'Failure' || !fetched.success) return
  if (isRecordReadOnly(table.fields, fetched.success as Readonly<Record<string, unknown>>)) {
    return toolFailure(
      -32_602,
      'Cannot update record: a field condition has made this record read-only'
    )
  }
}
