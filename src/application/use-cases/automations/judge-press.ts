/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The judgement of a press that names the record it was made on: a button
 * field, a row action, a record-bound button.
 *
 * The press NAMES a record and a control; the control is found in the config,
 * and its `visibleWhen` and `disabledWhen` are judged on the whole stored row —
 * a column the presser may not read included — so nothing the browser sends
 * decides the verdict. In order:
 *
 *   1. the control must exist on that table and start this automation;
 *   2. the row must exist, and the records API admit it to the presser (her
 *      row-level read rule, and on a scope table a grant naming it);
 *   3. a `visibleWhen` that does not hold hides the control;
 *   4. a `disabledWhen` that holds disables it.
 *
 * The first three answer as an automation nobody declared does (the road may
 * have no session gate, so a refusal must not tell which records exist); the
 * fourth answers with the control's reason, its `$record.*` read from the
 * fields the presser may read and its `$t:` key in the app's default language.
 *
 * A control with neither condition has nothing to judge: the press passes, as
 * it did before a press could name its record.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { callerReadScope } from '@/application/use-cases/tables/permissions/caller-read-authority'
import { readerRowsOf } from '@/application/use-cases/tables/row-read-admission'
import {
  defaultLanguageTranslator,
  resolveInterpreterString,
} from '@/domain/models/app/languages/translation-resolver'
import {
  controlStateOn,
  findTableControl,
  type RecordControl,
} from '@/domain/models/app/pages/record-control-service'
import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import { admitsRow } from '@/domain/models/app/tables/row-read-admission-service'
import { logError } from '@/infrastructure/logging/logger'
import { callerLinkReader } from './action-handlers/record-caller-gate'
import { buildGuestSession, buildSyntheticSession, buildSystemSession } from './build-guest-session'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { PressReference } from '@/domain/models/api/automations/automations'
import type { App } from '@/domain/models/app'

type Row = Readonly<Record<string, unknown>>

/** Why a press was refused: as an unknown automation, or disabled with its reason. */
export type PressRefusal =
  | { readonly _tag: 'AutomationNotFound'; readonly name: string }
  | { readonly _tag: 'AutomationPressDisabled'; readonly name: string; readonly message: string }

/** The pressed row, or `undefined` when it does not exist or could not be read. */
const readPressedRow = (press: PressReference) =>
  Effect.gen(function* () {
    const repo = yield* TableRepository
    return yield* repo.getRecord(buildSystemSession(), press.table, press.recordId)
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[automations] pressed record not read', cause))
    ),
    // effect-swallow: a row that could not be read fails closed — the press is
    // refused as an unknown automation rather than run unjudged.
    Effect.orElseSucceed(() => null)
  )

/**
 * How the presser reads the pressed table: `'whole'` in an app without
 * sign-in (every row, every column), her read scope otherwise, or `undefined`
 * when she may not read the table at all.
 */
const readerScopeOf = (app: App, press: PressReference, userId: string | undefined) =>
  Effect.gen(function* () {
    if (app.auth === undefined) return 'whole' as const
    const session = userId === undefined ? buildGuestSession() : buildSyntheticSession(userId)
    const scope = yield* callerReadScope(app, session, press.table)
    // The rows the records API admits her: on a scope table, only those a grant names.
    const { admission } = yield* readerRowsOf(app, press.table, yield* callerLinkReader(userId))
    return scope === undefined ? undefined : { scope, admission }
  })

/**
 * The pressed row as the presser reads it — the projection a reason's
 * `$record.*` is filled from — or `undefined` when her row-level read rule
 * refuses the row, or she may not read the table.
 */
const readerProjection = (
  scope: Effect.Success<ReturnType<typeof readerScopeOf>>,
  row: Row
): Row | undefined => {
  if (scope === 'whole') return row
  if (scope === undefined || !admitsRow(scope.admission, String(row['id']))) return undefined
  return scope.scope.admits(row) ? scope.scope.project(row) : undefined
}

/** A disabled control's message: its reason, read from what the presser reads, or the generic one. */
const disabledMessage = (app: App, control: RecordControl, readable: Row): string => {
  const { languages } = app
  if (control.disabledReason === undefined) {
    return resolveInterpreterString('action.disabled', languages?.default, languages)
  }
  return substituteRecordVars(
    defaultLanguageTranslator(languages)(control.disabledReason),
    readable
  )
}

/**
 * Judge a press of automation `name` that names its record. Succeeds when the
 * press may run; fails with the {@link PressRefusal} it is answered with.
 */
export const judgePress = Effect.fn('automations.judge-press')(function* (input: {
  readonly app: App
  readonly name: string
  readonly press: PressReference
  readonly userId: string | undefined
}): Effect.fn.Return<void, PressRefusal, TableRepository | AuthRepository | DataSourceRepository> {
  const { app, name, press, userId } = input
  const unknown = { _tag: 'AutomationNotFound' as const, name }
  const control = findTableControl(app, press.table, press.control)
  if (control === undefined || control.automation !== name) return yield* Effect.fail(unknown)
  if (control.visibleWhen === undefined && control.disabledWhen === undefined) return
  // The scope first, then the row, whatever either answers: an unknown row and
  // an unreadable one take the same reads, so their 404s cannot be told apart.
  const scope = yield* readerScopeOf(app, press, userId)
  const row = yield* readPressedRow(press)
  const readable = row === null ? undefined : readerProjection(scope, row)
  if (row === null || readable === undefined) return yield* Effect.fail(unknown)
  const state = controlStateOn(control, row)
  if (state === 'hidden') return yield* Effect.fail(unknown)
  if (state === 'disabled') {
    const message = disabledMessage(app, control, readable)
    return yield* Effect.fail({ _tag: 'AutomationPressDisabled' as const, name, message })
  }
})
