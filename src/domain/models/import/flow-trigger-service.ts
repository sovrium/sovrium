/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A flow's trigger as a Sovrium trigger: `cron`, `webhook`, `manual`, and —
 * when the table or form it watches is migrated with it — `record` or `form`.
 *
 * A trigger that does not map becomes `manual` — or the `webhook` a form
 * trigger names as its fallback, when the source tool can post submissions to
 * one — so the automation still validates, and its definition is quoted as a TODO: the automation then starts
 * only by hand until someone rebuilds the trigger. A schedule stated as an
 * interval becomes cron only through {@link INTERVAL_SCHEDULES}, where the
 * cron expression fires at exactly the same times.
 *
 * An app event whose trigger row stands it in by a webhook becomes that
 * webhook, and names the connection operation that points the vendor at it
 * (lemlist's `post-hooks`), so the connection is installed with it declared.
 * A form trigger falling back to a webhook names its form app's operation the
 * same way (Typeform's `put-webhook`); an imported form needs none.
 * An app event the vendor cannot push becomes a cron trigger carrying the call that
 * lists the new items, which the mapper turns into the automation's first
 * steps (`flow-poll-service.ts`).
 */

import { POLL_SCHEDULE } from './app-trigger-mappings'
import { quoteOriginal } from './credential-redaction-service'
import { isAutomationSourceTool, lookupTrigger } from './flow-step-mappings'
import type { CanonicalFlow } from './canonical-flow'
import type { PollSource } from './flow-step-targets'
import type { ConfigEntry } from './table-mapper-service'

/** The connection operation that registers a webhook with the vendor. */
export interface TriggerRegistration {
  readonly slug: string
  readonly operation: string
  readonly credential?: string
}

/** A polled app event: the list call, read like an app step of the trigger's app. */
export interface TriggerPoll extends PollSource {
  readonly app: string
  readonly event: string
  readonly inputs: Readonly<Record<string, unknown>>
  readonly credential?: string
}

/** The Sovrium trigger, and the original quoted when it did not map. */
export interface TriggerOutcome {
  readonly trigger: ConfigEntry
  readonly todo?: string
  /** Why the trigger is a TODO, when its row says so. */
  readonly reason?: string
  /** The operation the automation's webhook is registered with. */
  readonly registration?: TriggerRegistration
  /** For a polled app event, how the automation lists the new items. */
  readonly poll?: TriggerPoll
}

/** The imported names a record or form trigger watches. */
export interface TriggerTargets {
  /** The Sovrium table a source table (id or name) was imported as. */
  readonly table?: (source: string) => string | undefined
  /** The Sovrium form a source form (id or name) was imported as. */
  readonly form?: (source: string) => string | undefined
}

/** One interval wording, and the cron expression that fires at the same times. */
interface IntervalSchedule {
  readonly pattern: RegExp
  readonly cron: (match: Readonly<RegExpExecArray>) => string | undefined
}

const divides = (whole: number, part: number): boolean => part > 0 && whole % part === 0

/**
 * Interval schedules as cron. Only intervals that divide the hour or the day
 * are written: every 7 minutes, for instance, drifts against a cron step.
 */
export const INTERVAL_SCHEDULES: readonly IntervalSchedule[] = [
  {
    pattern: /^every (\d+) minutes?$/i,
    cron: (match) => {
      const every = Number(match[1])
      if (every === 1) return '* * * * *'
      return divides(60, every) ? `*/${String(every)} * * * *` : undefined
    },
  },
  {
    pattern: /^every (\d+) hours?$/i,
    cron: (match) => {
      const every = Number(match[1])
      if (every === 1) return '0 * * * *'
      return divides(24, every) ? `0 */${String(every)} * * *` : undefined
    },
  },
  {
    pattern: /^daily at ([01]\d|2[0-3]):([0-5]\d)$/i,
    cron: (match) => `${String(Number(match[2]))} ${String(Number(match[1]))} * * *`,
  },
]

/** An interval wording as cron, or `undefined` when no row fires at the same times. */
export const intervalToCron = (interval: string): string | undefined =>
  INTERVAL_SCHEDULES.flatMap((row) => {
    const match = row.pattern.exec(interval.trim())
    const cron = match === null ? undefined : row.cron(match)
    return cron === undefined ? [] : [cron]
  })[0]

type Trigger = CanonicalFlow['trigger']

const scheduleOf = (trigger: Extract<Trigger, { readonly kind: 'schedule' }>) => {
  const cron =
    trigger.cron ?? (trigger.interval === undefined ? undefined : intervalToCron(trigger.interval))
  if (cron === undefined) return undefined
  return {
    type: 'cron',
    expression: cron,
    ...(trigger.timezone === undefined ? {} : { timezone: trigger.timezone }),
  }
}

/** A record or form trigger, when the table or form it watches was imported. */
const watchedOf = (trigger: Trigger, targets: TriggerTargets): ConfigEntry | undefined => {
  if (trigger.kind === 'record') {
    const table = targets.table?.(trigger.table)
    return table === undefined || trigger.events.length === 0
      ? undefined
      : { type: 'record', table, events: trigger.events }
  }
  if (trigger.kind !== 'form') return undefined
  const form = targets.form?.(trigger.form)
  return form === undefined ? undefined : { type: 'form', form }
}

/** The Sovrium trigger, or `undefined` when the trigger does not map. */
const triggerOf = (trigger: Trigger, targets: TriggerTargets): ConfigEntry | undefined => {
  if (trigger.kind === 'schedule') return scheduleOf(trigger)
  if (trigger.kind === 'webhook') {
    return { type: 'webhook', method: (trigger.method ?? 'POST').toUpperCase() }
  }
  if (trigger.kind === 'manual') return { type: 'manual' }
  return watchedOf(trigger, targets)
}

type AppEvent = Extract<Trigger, { readonly kind: 'app-event' }>

/** The app event of a flow and its trigger row, when the flow starts on one. */
const appRowOf = (flow: CanonicalFlow) => {
  const { trigger, tool } = flow
  if (trigger.kind !== 'app-event' || !isAutomationSourceTool(tool)) return undefined
  return { trigger, row: lookupTrigger(tool, trigger.app, trigger.event) }
}

/** An app event its row polls for: a cron trigger, the list call carried for the mapper. */
const polledOf = (trigger: AppEvent, poll: PollSource, todo: string | undefined) => ({
  trigger: { type: 'cron', expression: POLL_SCHEDULE },
  todo: quoteOriginal(trigger),
  ...(todo === undefined ? {} : { reason: `${todo}.` }),
  poll: {
    ...poll,
    app: trigger.app,
    event: trigger.event,
    inputs: trigger.inputs,
    ...(trigger.credential === undefined ? {} : { credential: trigger.credential }),
  },
})

/** An app event its trigger row polls for, or `undefined`. */
const pollEventOf = (flow: CanonicalFlow): TriggerOutcome | undefined => {
  const found = appRowOf(flow)
  const poll = found?.row?.target === 'cron' ? found.row.poll : undefined
  return found === undefined || poll === undefined
    ? undefined
    : polledOf(found.trigger, poll, found.row?.todo)
}

/** An app event its trigger row stands in for with a webhook, or `undefined`. */
const appEventOf = (flow: CanonicalFlow): TriggerOutcome | undefined => {
  const found = appRowOf(flow)
  if (found?.row?.target !== 'webhook') return undefined
  const { trigger, row } = found
  const credential = trigger.credential === undefined ? {} : { credential: trigger.credential }
  return {
    trigger: { type: 'webhook', method: 'POST' },
    todo: quoteOriginal(trigger),
    ...(row.todo === undefined ? {} : { reason: `${row.todo}.` }),
    ...(row.connection === undefined
      ? {}
      : {
          registration: {
            slug: row.connection.connection,
            operation: row.connection.operation,
            ...credential,
          },
        }),
  }
}

/**
 * The operation that points a form tool at the webhook its trigger falls back
 * to, and the TODO naming it: the same registration an app event carries.
 */
const formRegistrationOf = (
  trigger: Extract<Trigger, { readonly kind: 'form' }>
): Pick<TriggerOutcome, 'reason' | 'registration'> => {
  const { registration } = trigger
  if (registration === undefined) return {}
  const { connection, operation } = registration
  return {
    reason: `${trigger.form === '' ? 'The form' : `The form ${trigger.form}`} was not imported with this automation, so it starts from a webhook: register it with the form app, pointing at this automation's webhook, with the ${connection} connection's ${operation} operation, or name the Sovrium form in its trigger.`,
    registration: {
      slug: connection,
      operation,
      ...(registration.credential === undefined ? {} : { credential: registration.credential }),
    },
  }
}

/** The Sovrium trigger, or `manual` plus a TODO when the trigger does not map. */
export const mapTrigger = (flow: CanonicalFlow, targets: TriggerTargets = {}): TriggerOutcome => {
  const appEvent = appEventOf(flow) ?? pollEventOf(flow)
  if (appEvent !== undefined) return appEvent
  const trigger = triggerOf(flow.trigger, targets)
  const standIn = 'todo' in flow.trigger ? flow.trigger.todo : undefined
  if (trigger !== undefined && standIn !== undefined) {
    return { trigger, todo: quoteOriginal(flow.trigger) }
  }
  if (trigger !== undefined) return { trigger }
  if (flow.trigger.kind === 'form' && flow.trigger.fallback === 'webhook') {
    return {
      trigger: { type: 'webhook', method: 'POST' },
      todo: quoteOriginal(flow.trigger),
      ...formRegistrationOf(flow.trigger),
    }
  }
  return { trigger: { type: 'manual' }, todo: quoteOriginal(flow.trigger) }
}
