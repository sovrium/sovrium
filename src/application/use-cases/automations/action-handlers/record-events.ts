/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The record handlers' write roads. A record a step writes goes through the
 * records API's one write road for its operation (`record-*-orchestration.ts`),
 * so it carries the side effects the same write through the records API
 * carries — its activity entry, the table's webhooks (at every depth), and its
 * record automations. Those automations start through the run's record-event
 * channel, which keeps the depth limit and dispatches them in the background:
 * see `run/record-event-channel.ts`.
 */

import { Effect } from 'effect'
import {
  createRecordVia,
  type RecordAutomationDispatch,
} from '@/application/use-cases/tables/record-create-orchestration'
import { deleteRecordVia } from '@/application/use-cases/tables/record-delete-orchestration'
import { updateRecordVia } from '@/application/use-cases/tables/record-update-orchestration'
import { normalizeTemplatedWriteValuesIn } from '@/domain/models/app/tables/templated-write-value-service'
import type { buildSyntheticSession, buildSystemSession } from '../build-guest-session'
import type { ActionOutcome, ActionRunContext, RecordWriteEvent } from './shared'
import type { LinkReader } from '@/application/use-cases/tables/linked-row-visibility'
import type { App } from '@/domain/models/app'

/** A failed step when this write would pass the record-event depth limit. */
export const recordEventLoopRefusal = (
  runContext: ActionRunContext | undefined,
  tableName: string,
  event: RecordWriteEvent['event'],
  fields?: readonly string[]
): ActionOutcome | undefined => {
  const reason = runContext?.recordEvents?.refusal(tableName, event, fields)
  return reason === undefined ? undefined : { status: 'failure', error: reason }
}

/** Start the record automations of a write the step made. */
export const announceRecordWrite = (
  runContext: ActionRunContext | undefined,
  write: RecordWriteEvent
): Effect.Effect<void> =>
  Effect.sync(() => runContext?.recordEvents?.dispatch(write)).pipe(
    Effect.withSpan('automations.announce-record-write')
  )

/**
 * The run's record-event channel as a write road's automation dispatch: the
 * record automations a step's write fires start one level deeper, in the
 * background, as `run/record-event-channel.ts` decides.
 */
const throughChannel =
  (runContext: ActionRunContext | undefined): RecordAutomationDispatch =>
  (input) =>
    announceRecordWrite(runContext, {
      tableName: input.tableName,
      event: input.event,
      record: input.record,
      ...(input.previousRecord === undefined ? {} : { previousRecord: input.previousRecord }),
    })

/**
 * What every step write hands its write road beyond the record: no caller role
 * judges the echo (the step's own gate already ran), the env the channel
 * passes on itself, and the engine's SQLite AI baseline left as it was for
 * automation writes. The webhook deliveries are attempted in the background —
 * no request waits on a run.
 */
const STEP_WRITE = {
  processEnv: {},
  isSqlite: false,
  deliveryMode: 'background',
  // A step keeps the stored files its update replaced, as it always has: the
  // attach step deletes one only once no record names it any more.
  replacedAttachments: 'keep',
  forgetDerivedVariants: () => undefined,
} as const

/**
 * Create one record through the create road, its automations started through
 * the channel. Every write a step makes passes here or through
 * {@link updateAndAnnounce}, so a templated value is read as its column expects
 * (an empty number or key is `null`, JSON text in a `json` column its structure)
 * once, for create, update, upsert and the batch operators alike.
 */
export const createAndAnnounce = (input: {
  readonly session: ReturnType<typeof buildSyntheticSession>
  readonly app: App
  readonly tableName: string
  readonly fields: Readonly<Record<string, unknown>>
  readonly runContext: ActionRunContext | undefined
}) =>
  createRecordVia(
    {
      ...STEP_WRITE,
      session: input.session,
      app: input.app,
      tableName: input.tableName,
      fields: normalizeTemplatedWriteValuesIn(input.app.tables, input.tableName, input.fields),
    },
    throughChannel(input.runContext)
  ).pipe(Effect.withSpan('automations.create-and-announce'))

/** Update one record through the update road, its automations started through the channel. */
export const updateAndAnnounce = (input: {
  readonly session: ReturnType<typeof buildSyntheticSession>
  readonly tableName: string
  readonly recordId: string
  readonly fields: Readonly<Record<string, unknown>>
  readonly runContext: ActionRunContext | undefined
  readonly app: App
  /** Who a cleared many-to-many field is cleared for; absent, every link goes. */
  readonly linkReader?: LinkReader
}) =>
  Effect.asVoid(
    updateRecordVia(
      {
        ...STEP_WRITE,
        ...{ session: input.session, app: input.app, tableName: input.tableName },
        recordId: input.recordId,
        fields: normalizeTemplatedWriteValuesIn(input.app.tables, input.tableName, input.fields),
        ...(input.linkReader === undefined ? {} : { linkReader: input.linkReader }),
      },
      throughChannel(input.runContext)
    )
  ).pipe(Effect.withSpan('automations.update-and-announce'))

/** Delete one record through the delete road (to the trash), its automations started through the channel. */
export const deleteAndAnnounce = (input: {
  readonly session: ReturnType<typeof buildSystemSession>
  readonly app: App
  readonly tableName: string
  readonly recordId: string
  readonly runContext: ActionRunContext | undefined
}) =>
  deleteRecordVia(
    {
      ...STEP_WRITE,
      ...{ session: input.session, app: input.app, tableName: input.tableName },
      recordId: input.recordId,
      mode: 'soft',
    },
    throughChannel(input.runContext)
  ).pipe(Effect.withSpan('automations.delete-and-announce'))
