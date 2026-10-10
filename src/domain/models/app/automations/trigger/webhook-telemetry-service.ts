/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Who receives a telemetry protocol, and on what terms.
 *
 * A webhook trigger declaring `protocol` is not reached by its own name: the
 * engine mounts the protocol's standard paths, and every automation declaring
 * the same protocol runs for what arrives there. This module answers the four
 * questions the route asks before it reads a byte of the body — which
 * automations receive the protocol, where the sender's key is in the request,
 * which path is a protocol path, and what budget the sender has — so the rules
 * are written once and tested without a server.
 */

import { isAutomationOperationallyEnabled } from '../automation-operational-state'
import { triggerOfType } from '../trigger-entries-service'
import type { Trigger } from './trigger'
import type { WebhookTrigger } from './webhook'

/** A telemetry protocol a webhook trigger can receive. */
export type TelemetryProtocol = NonNullable<WebhookTrigger['protocol']>

/** A Sentry envelope item kind that starts a run. */
export type SentryItemKind = NonNullable<WebhookTrigger['items']>[number]

/** One automation receiving a protocol, with the webhook entry that declares it. */
export interface TelemetryReceiver {
  readonly automation: string
  readonly trigger: WebhookTrigger
}

interface AutomationLike {
  readonly name: string
  readonly enabled?: boolean | undefined
  readonly triggers: ReadonlyArray<Trigger>
}

/**
 * Every automation declaring `protocol` that may produce a run now: a
 * config-disabled or operationally paused one receives nothing.
 */
export const telemetryReceivers = (
  automations: ReadonlyArray<AutomationLike> | undefined,
  protocol: TelemetryProtocol,
  pausedNames: ReadonlySet<string>
): readonly TelemetryReceiver[] =>
  (automations ?? []).flatMap((automation) => {
    if (!isAutomationOperationallyEnabled(automation, pausedNames)) return []
    const trigger = triggerOfType(automation, 'webhook')
    return trigger?.protocol === protocol ? [{ automation: automation.name, trigger }] : []
  })

/** Whether the app declares `protocol` on an enabled automation: its paths are mounted. */
export const declaresTelemetryProtocol = (
  automations: ReadonlyArray<AutomationLike> | undefined,
  protocol: TelemetryProtocol
): boolean => telemetryReceivers(automations, protocol, new Set()).length > 0

/** Whether a receiver takes `kind` items: every kind when `items` is omitted. */
export const receivesItemKind = (trigger: WebhookTrigger, kind: SentryItemKind): boolean =>
  trigger.items === undefined || trigger.items.includes(kind)

/** `/api/<project>/envelope/`, with or without the trailing slash. */
const SENTRY_ENVELOPE_PATH = /^\/api\/[^/]+\/envelope\/?$/

/** Whether a request path is the Sentry envelope path of some project. */
export const isSentryEnvelopePath = (path: string): boolean => SENTRY_ENVELOPE_PATH.test(path)

const SENTRY_KEY = /(?:^|[\s,])sentry_key\s*=\s*([^,\s]+)/

/**
 * The public key a Sentry-compatible client presents: in `X-Sentry-Auth`
 * (`Sentry sentry_version=7, sentry_key=<key>`), in `Authorization` written
 * the same way, or in the `sentry_key` query parameter a browser SDK uses.
 */
export const sentryKeyOf = (input: {
  readonly sentryAuthHeader: string | undefined
  readonly authorizationHeader: string | undefined
  readonly queryKey: string | undefined
}): string | undefined => {
  const fromHeader = [input.sentryAuthHeader, input.authorizationHeader]
    .map((header) => (header === undefined ? undefined : SENTRY_KEY.exec(header)?.[1]))
    .find((key) => key !== undefined && key !== '')
  if (fromHeader !== undefined) return fromHeader
  return input.queryKey !== undefined && input.queryKey !== '' ? input.queryKey : undefined
}

const BEARER = /^Bearer\s+(\S+)\s*$/i

/** The key an OTLP exporter presents: `Authorization: Bearer <key>`. */
export const bearerKeyOf = (authorizationHeader: string | undefined): string | undefined =>
  authorizationHeader === undefined ? undefined : BEARER.exec(authorizationHeader)?.[1]

/** The budget a protocol sender has when no receiver declares one. */
export const DEFAULT_INGEST_BUDGET = { maxRequests: 1200, windowSeconds: 60 } as const

/** A request budget, and what it is counted per. */
export interface IngestBudget {
  readonly maxRequests: number
  readonly windowSeconds: number
  readonly per: 'ip' | 'project'
}

const budgetOf = (trigger: WebhookTrigger): IngestBudget => {
  const declared = trigger.rateLimit
  return {
    maxRequests: declared?.maxRequests ?? DEFAULT_INGEST_BUDGET.maxRequests,
    windowSeconds:
      declared?.windowSeconds ?? declared?.window ?? DEFAULT_INGEST_BUDGET.windowSeconds,
    per: declared?.per ?? 'project',
  }
}

/** Requests per second a budget allows: the lower, the stricter. */
const rateOf = (budget: IngestBudget): number => budget.maxRequests / budget.windowSeconds

/**
 * The budget one protocol request is counted against: the strictest among the
 * receivers it reaches, so one request is counted once however many
 * automations run for it. Counted per project unless that receiver says `ip`.
 */
export const strictestIngestBudget = (triggers: ReadonlyArray<WebhookTrigger>): IngestBudget => {
  const [first, ...rest] = triggers.map(budgetOf)
  if (first === undefined) return { ...DEFAULT_INGEST_BUDGET, per: 'project' }
  return rest.reduce(
    (strictest, budget) => (rateOf(budget) < rateOf(strictest) ? budget : strictest),
    first
  )
}
