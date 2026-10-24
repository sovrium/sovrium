/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Who a stored run acts as when it carries on: a resume after a wait or an
 * approval, and a replay of its own data.
 *
 * A run someone started by hand acts as that person; a run started by a
 * visitor who was not signed in acts as a visitor, and names nobody. A hand-started run whose starter was since
 * erased names nobody and so acts as no one.
 *
 * And who a webhook run starts as: a `session` webhook's run is started by hand
 * by the person who called it — unless it acts as the system for a machine
 * caller (its answer reveals write-only fields to it, or it declares
 * `auth.runAs: 'system'`), whose run reads and writes as the system. Every run
 * of a webhook declaring `runAs: 'system'` is read by an admin only.
 */

import { triggersOfType } from './trigger-entries-service'
import type { Trigger } from './trigger'

/** The starter columns of a stored run. */
export interface StoredRunStarter {
  readonly startedByHand: boolean
  readonly startedAsGuest?: boolean
  readonly triggeredByUserId: string | null
}

/** Who a stored run started by hand carries on as. */
export type StoredHandStarter =
  | { readonly startedByHand: true; readonly userId: string | undefined }
  | { readonly startedByHand: true; readonly userId: undefined; readonly startedAsGuest: true }

/** The hand-starter a stored run carries on as, or `undefined` for a run nobody started. */
export const handStarterOfStoredRun = (run: StoredRunStarter): StoredHandStarter | undefined => {
  if (!run.startedByHand) return undefined
  if (run.startedAsGuest === true) {
    return { startedByHand: true, userId: undefined, startedAsGuest: true }
  }
  return { startedByHand: true, userId: run.triggeredByUserId ?? undefined }
}

/**
 * Whether a webhook run is started by hand by its caller: only behind a
 * `session` webhook a person called, and never when it acts as the system for
 * a machine caller (`actsAsSystem`, decided at the webhook's door).
 */
export const webhookStartsByHand = (
  trigger: Trigger,
  userId: string | undefined,
  actsAsSystem: boolean | undefined
): boolean =>
  trigger.type === 'webhook' &&
  trigger.auth?.type === 'session' &&
  userId !== undefined &&
  actsAsSystem !== true

/**
 * Whether only an admin reads the runs of this automation: one of its webhooks
 * declares `auth.runAs: 'system'`. Decided by the configuration, whoever started
 * a run and however — a cookie caller's run, which acted as her, included.
 */
export const runsReadByAdminOnly = (automation: {
  readonly triggers: ReadonlyArray<Trigger>
}): boolean => triggersOfType(automation, 'webhook').some((t) => t.auth?.runAs === 'system')
