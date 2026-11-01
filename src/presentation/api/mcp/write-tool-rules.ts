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
 * create tool ran three of the create chain's rules, so a caller refused a
 * value over REST (a missing required field, a foreign attachment key) wrote
 * it through MCP. The table's business rules are not run here: the write
 * itself judges them, on every road (`business-rule-gate.ts`).
 *
 *  - create: `validateRecordCreation` — readonly and computed columns,
 *    field-write permission, slug, required fields, formats, `multi-select`,
 *    `maxLinked`, attachment references and constraints, inline uploads.
 *  - update: the engine-managed and computed columns, then
 *    `checkRecordUpdateValues` — what `PATCH /api/tables/:t/records/:id` runs
 *    after its gates.
 *
 * A `rich-text` value is cleaned, and every format checked, by the write
 * itself on every road (`record-write-values.ts`).
 *
 * Every refusal is thrown as a JSON-RPC error carrying the records API's own
 * sentence; nothing of a stored row is echoed.
 */

import { Effect } from 'effect'
import {
  findComputedFieldWrites,
  readonlyFieldWriteMessage,
} from '@/domain/models/app/tables/computed-field-write-validation'
import { runOnDomain } from '@/infrastructure/logging/request-effect'
import {
  provideValidationContext,
  type FieldFormatError,
  type FieldPermissionError,
  type FieldStorageError,
  type FieldValidationError,
} from '@/presentation/api/middleware/validation'
import {
  checkRecordUpdateValues,
  findReadonlyUpdateField,
  validateRecordCreation,
} from '@/presentation/api/tables/record-rules'
import { toolFailure } from './tool-call-helpers'
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
  /**
   * The caller's user id — every authenticated MCP credential names a user row —
   * recorded as the uploader of any inline file a create stores, as the
   * records API records its writer. Absent only on the fail-closed fallback.
   */
  readonly writerId: string | undefined
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
      provideValidationContext(input.app, input.table.name, {
        role: input.userRole,
        groups: input.userGroups,
        signedOut: input.signedOut,
        id: input.writerId,
      })
    )
  )

/** The values an update writes, after the records API's per-value update rules. */
export const applyUpdateRules = (
  input: WriteRuleInput,
  fields: Readonly<Record<string, unknown>>
): Promise<Record<string, unknown>> => {
  // The engine-managed columns, then a computed field (a value or a `null`
  // clear alike), the first in the table's field order — refused, never dropped.
  const readonlyField =
    findReadonlyUpdateField(fields) ?? findComputedFieldWrites(input.table.fields, [fields])[0]
  if (readonlyField !== undefined) {
    return toolFailure(-32_602, readonlyFieldWriteMessage(readonlyField))
  }
  const values = { ...fields }
  return runRules(
    input,
    checkRecordUpdateValues(values).pipe(
      provideValidationContext(input.app, input.table.name, {
        role: input.userRole,
        groups: input.userGroups,
        signedOut: input.signedOut,
      })
    )
  )
}
