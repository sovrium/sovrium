/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a form answers a submission refused because a `unique` value is taken.
 *
 * In order:
 *
 * 1. the field's own `takenMessage`, when its author wrote one — a deliberate
 *    statement that the form tells anyone the value exists;
 * 2. the field-level "already in use" message, when the submitter could read
 *    the value on every record holding it — judged by the records API's own
 *    rule (`unique-conflict-answer-program.ts`), an app with no sign-in
 *    keeping every table open;
 * 3. otherwise the failure itself, which the route answers with the form's
 *    generic refusal, naming no field.
 *
 * A collision the form cannot place is answered as in 3.
 */

import { Effect } from 'effect'
import { buildSyntheticSession } from '@/application/use-cases/automations/build-guest-session'
import {
  loadCurrentUserContext,
  rowRuleScopeOf,
} from '@/application/use-cases/tables/permissions/row-level-enforcement'
import { uniqueConflictAnswerProgram } from '@/application/use-cases/tables/unique-conflict-answer-program'
import {
  buildEffectiveRoles,
  getUserAccessRoles,
  getUserGroups,
} from '@/application/use-cases/tables/user-groups'
import { GUEST_USER_ID } from '@/domain/models/app/auth/guest-session'
import { hasReadPermissionForCaller } from '@/domain/models/app/auth/permission-evaluator-service'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { rowPassesRule } from '@/domain/models/app/tables/row-level-write-decision-service'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import { languageUniqueBaseField } from '@/domain/models/app/tables/translatable-unique-service'
import { FormFieldConstraintError, uniqueRefusalForField } from './submit-form-constraint-errors'
import type { UniqueConstraintViolationError } from '@/domain/errors'
import type { App, Table } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/** The `takenMessage` of the form field writing `column`, if its author wrote one. */
const takenMessageOf = (form: Readonly<Form>, column: string | undefined): string | undefined => {
  if (column === undefined) return undefined
  const mapping = form.submitTo?.mapping ?? {}
  // The field that WRITES `column`: its mapping target, or its own name when it has none.
  const field = form.fields.find(
    (candidate) =>
      candidate.kind === 'table-field' && (mapping[candidate.column] ?? candidate.column) === column
  )
  return field?.kind === 'table-field' ? field.takenMessage : undefined
}

/** The field's own refusal, when its author wrote a `takenMessage` for the refused column. */
const authoredTakenRefusal = (
  form: Readonly<Form>,
  unique: Readonly<UniqueConstraintViolationError>
): Readonly<FormFieldConstraintError> | undefined => {
  const column =
    unique.fieldName === undefined ? undefined : languageUniqueBaseField(unique.fieldName)
  const message = takenMessageOf(form, column)
  return message !== undefined && column !== undefined
    ? new FormFieldConstraintError({ fieldName: column, message })
    : undefined
}

/** The submitter as the records API's read rule judges her. */
const readerOf = (input: {
  readonly app: Readonly<App>
  readonly table: Table
  readonly submitterUserId: string | undefined
  readonly role: string
}) =>
  Effect.gen(function* () {
    const { app, table, submitterUserId, role } = input
    const signedOut = submitterUserId === undefined
    const userId = submitterUserId ?? GUEST_USER_ID
    const groups = signedOut ? [] : yield* getUserGroups(userId)
    const accessRoles =
      signedOut || table.rowLevelPermissions === undefined ? [] : yield* getUserAccessRoles(userId)
    const effectiveRoles = [...buildEffectiveRoles(role, groups), ...accessRoles]
    const isUnrestricted = isAdminEquivalent(role, app)
    const ruled = table.rowLevelPermissions?.read !== undefined && !isUnrestricted
    const ctx = ruled
      ? yield* loadCurrentUserContext(
          { userId, role: signedOut ? GUEST_USER_ID : role, isUnrestricted },
          table.rowLevelPermissions,
          rowRuleScopeOf(table, app.tables)
        )
      : undefined
    return {
      role,
      groups,
      readsTable: hasReadPermissionForCaller(table, { effectiveRoles, signedOut }, app),
      rowReadable: ruled
        ? (row: Readonly<Record<string, unknown>>) =>
            rowPassesRule(table.rowLevelPermissions, 'read', readStoredValues(table, row), ctx)
        : undefined,
    }
  })

/** The refusal a submission gets for a value its bound table already holds. */
export const takenValueRefusal = Effect.fn('forms.taken-value-refusal')(function* (input: {
  readonly app: Readonly<App>
  readonly form: Readonly<Form>
  readonly mapped: Readonly<Record<string, unknown>>
  readonly unique: UniqueConstraintViolationError
  readonly submitterUserId: string | undefined
  readonly visitor: Readonly<Record<string, unknown>> | undefined
}) {
  const { app, form, unique } = input
  const authored = authoredTakenRefusal(form, unique)
  if (authored !== undefined) return authored
  const named = uniqueRefusalForField(unique) ?? unique
  if (app.auth === undefined) return named
  const table = app.tables?.find((candidate) => candidate.name === form.submitTo?.table)
  if (table === undefined) return unique
  const role = typeof input.visitor?.['role'] === 'string' ? input.visitor['role'] : ''
  const reader = yield* readerOf({ app, table, submitterUserId: input.submitterUserId, role })
  const answer = yield* uniqueConflictAnswerProgram({
    session: buildSyntheticSession(input.submitterUserId ?? GUEST_USER_ID),
    app: app as App,
    table,
    write: { written: [input.mapped] },
    reader,
  })
  return answer === 'conflict' ? named : unique
})
