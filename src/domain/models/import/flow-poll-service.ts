/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A polled app event as the first actions of its automation, under the cron
 * trigger `flow-trigger-service.ts` gives it:
 *
 * 1. `fetch_new` — the list call, resolved like an app step of the trigger's
 *    app (`flow-app-call-service.ts`): a `connection/call` when the connection
 *    declares the operation, else an `http/request` on the connection;
 * 2. `keep_new` — a `state/filterNew` keyed on the field identifying an item,
 *    when the items carry one, so each item is handled once across runs;
 * 3. `each_new` — a `loop/each` over the new items, holding the source's own
 *    steps, which read the item where they read the trigger before.
 *
 * Nothing here schedules anything: the cron expression is a placeholder the
 * trigger's TODO asks the operator to set.
 */

import {
  appCallOutcome,
  resolveAppCall,
  type AppCallTarget,
  type ConnectionCall,
} from './flow-app-call-service'
import { call } from './flow-step-targets'
import type { CanonicalStep } from './canonical-flow'
import type { TriggerPoll } from './flow-trigger-service'
import type { ConfigEntry } from './table-mapper-service'

/** The names of the three polling actions, kept from the source steps' names. */
const POLL_ACTION_NAMES = ['fetch_new', 'keep_new', 'each_new'] as const

const [FETCH, KEEP, EACH] = POLL_ACTION_NAMES

/** Where a source step reads what was its trigger: the item of the polling loop. */
const POLL_TRIGGER_ROOT = `loops.${EACH}.item`

/** The polling actions around the source's own, and what they add to the report. */
export interface PolledActions {
  readonly actions: readonly ConfigEntry[]
  readonly todo: readonly {
    readonly action: string
    readonly original: string
    readonly reason: string
  }[]
  readonly calls: readonly ConnectionCall[]
}

/** The list call as the app step it is resolved like. */
const fetchStep = (poll: TriggerPoll): Extract<CanonicalStep, { readonly kind: 'app-action' }> => ({
  id: FETCH,
  name: FETCH,
  kind: 'app-action',
  app: poll.app,
  operation: poll.event,
  inputs: poll.inputs,
  ...(poll.credential === undefined ? {} : { credential: poll.credential }),
})

/** The template reading the list out of the fetch step's output. */
const listOf = (action: ConfigEntry, items: string | undefined): string => {
  const output = action['type'] === 'connection' ? `${FETCH}.data` : `${FETCH}.response.body`
  return `{{${items === undefined ? output : `${output}.${items}`}}}`
}

/** The polling actions, given the source's own actions to run once per new item. */
type PollWrap = (actions: readonly ConfigEntry[]) => PolledActions

/**
 * How a polled trigger wraps its automation's actions, or `undefined` when the
 * list call lands nowhere (its connection is neither in the library nor in the
 * catalogue), so the mapper keeps the plain trigger TODO and the steps unwrapped.
 */
const pollWrapOf = (
  poll: TriggerPoll,
  target: Omit<AppCallTarget, 'name'>
): PollWrap | undefined => {
  const step = fetchStep(poll)
  const named = { ...target, name: FETCH }
  const resolved = resolveAppCall(
    step,
    { source: poll.app, target: call(poll.connection, poll.operation) },
    named
  )
  if (resolved === undefined) return undefined
  const fetched = appCallOutcome(step, resolved, named)
  const list = listOf(fetched.action, poll.items)
  const keep: readonly ConfigEntry[] =
    poll.key === undefined
      ? []
      : [
          {
            name: KEEP,
            type: 'state',
            operator: 'filterNew',
            props: { input: list, key: poll.key },
          },
        ]
  return (actions) => ({
    actions: [
      fetched.action,
      ...keep,
      {
        name: EACH,
        type: 'loop',
        operator: 'each',
        props: { items: poll.key === undefined ? list : `{{${KEEP}.items}}`, actions },
      },
    ],
    todo: fetched.todo === undefined ? [] : [{ action: FETCH, ...fetched.todo }],
    calls: fetched.connection === undefined ? [] : [fetched.connection],
  })
}

/** How the mapper lays an automation out around its trigger: polled, or as the source had it. */
export interface Polling {
  /** The automation's actions, given the source's own. */
  readonly wrap: PollWrap
  /** Action names the source steps may not take. */
  readonly reserved: readonly string[]
  /** Where a trigger reference reads from, when not `trigger.data`. */
  readonly triggerRoot?: string
  /** Whether the source steps are the automation's own list, so a filter may end the run. */
  readonly top: boolean
}

/**
 * The layout of an automation whose trigger is `poll`: the polling actions
 * around the source's, or, with no poll or one whose list call lands nowhere,
 * the source's actions as they are, reading the trigger from `root`.
 */
export const pollingOf = (
  poll: TriggerPoll | undefined,
  target: Omit<AppCallTarget, 'name'>,
  root: string | undefined
): Polling => {
  const wrap = poll === undefined ? undefined : pollWrapOf(poll, target)
  if (wrap !== undefined)
    return { wrap, reserved: POLL_ACTION_NAMES, triggerRoot: POLL_TRIGGER_ROOT, top: false }
  return {
    wrap: (actions) => ({ actions, todo: [], calls: [] }),
    reserved: [],
    ...(root === undefined ? {} : { triggerRoot: root }),
    top: true,
  }
}
