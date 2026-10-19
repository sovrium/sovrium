/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The comment half of a run's event channel.
 *
 * A comment a step writes starts the comment automations of its table, as a
 * comment posted through the comments API does. A comment automation that
 * answers comments with comments re-triggers itself, and a config cannot be
 * refused for that at validation the way a visible record loop is: it may be
 * exactly what the author wants, once. So the chain is bounded the way a chain
 * of record events is, on the SAME counter — a record write and a comment each
 * count one automation write — and the step that would start a run past
 * {@link MAX_RECORD_EVENT_DEPTH} fails, naming the limit, instead of writing.
 *
 * The dispatch runs in the background, for the reason the record channel's
 * does: a run waiting on the runs its own comments start would hold its
 * concurrency slot while they waited for one.
 */

import { AutomationFiberBridge } from '@/application/ports/services/automation-fiber-bridge'
import { triggersOfType } from '@/domain/models/app/automations/trigger-entries-service'
import { logError } from '@/infrastructure/logging/logger'
import {
  triggerCommentEventAutomations,
  type TriggerCommentEventInput,
} from '../trigger-comment-event'
import {
  buildRecordEventChannel,
  MAX_RECORD_EVENT_DEPTH,
  type RecordEventChannel,
} from './record-event-channel'
import type { StepContext } from './types'
import type { App } from '@/domain/models/app'

/** A comment a step wrote, as the comment triggers read it. */
export type StepCommentEvent = Omit<TriggerCommentEventInput, 'app' | 'processEnv' | 'depth'>

/** How the comments a step writes reach the comment triggers. */
export interface CommentEventChannel {
  /** The refusal a comment on `tableName` meets past the depth limit, before it is written. */
  readonly refusal: (tableName: string) => string | undefined
  /** Start the comment automations a written comment matches, in the background. */
  readonly dispatch: (comment: StepCommentEvent) => void
}

/** True when some comment automation of `app` listens to `tableName`. */
const hasCommentAutomations = (app: App, tableName: string): boolean =>
  (app.automations ?? []).some((automation) =>
    triggersOfType(automation, 'comment').some((trigger) => trigger.table === tableName)
  )

/** What the channel reads from the run it belongs to. */
type ChannelContext = Pick<StepContext, 'app' | 'processEnv' | 'recordEventDepth' | 'runProgram'>

/** Build the comment channel for one run. */
export const buildCommentEventChannel = (ctx: ChannelContext): CommentEventChannel => ({
  refusal: (tableName) =>
    ctx.recordEventDepth >= MAX_RECORD_EVENT_DEPTH && hasCommentAutomations(ctx.app, tableName)
      ? `Stopped a comment loop: this comment on '${tableName}' would start its comment automations ${String(ctx.recordEventDepth + 1)} automation writes deep, past the depth limit of ${String(MAX_RECORD_EVENT_DEPTH)}.`
      : undefined,
  dispatch: (comment) => {
    if (!hasCommentAutomations(ctx.app, comment.tableName)) return
    const program = triggerCommentEventAutomations({
      ...comment,
      app: ctx.app,
      processEnv: ctx.processEnv,
      depth: ctx.recordEventDepth + 1,
    })
    // eslint-disable-next-line functional/no-expression-statements -- background dispatch; see the module doc for why the step does not wait
    ctx.runProgram(AutomationFiberBridge.use((bridge) => bridge.trackBackground(program))).then(
      () => undefined,
      (error: unknown) => {
        logError('[automation:comment-posted] background dispatch from a step rejected', error)
      }
    )
  },
})

/** A run's event channel: its record events, and the comments its steps write, on one depth. */
export const buildRunEventChannel = (
  ctx: Parameters<typeof buildRecordEventChannel>[0]
): RecordEventChannel => ({
  ...buildRecordEventChannel(ctx),
  comments: buildCommentEventChannel(ctx),
})
