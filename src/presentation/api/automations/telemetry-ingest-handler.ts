/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { loadPausedAutomationNames } from '@/application/use-cases/automations/paused-automation-names'
import { runWebhookAutomation } from '@/application/use-cases/automations/run-automation'
import {
  decodeOtlpLogsRequest,
  normaliseOtlpLogs,
} from '@/domain/models/app/automations/trigger/otlp-logs-ingest-service'
import {
  normaliseSentryItem,
  parseSentryEnvelope,
} from '@/domain/models/app/automations/trigger/sentry-envelope-ingest-service'
import {
  bearerKeyOf,
  receivesItemKind,
  sentryKeyOf,
  strictestIngestBudget,
  telemetryReceivers,
  type TelemetryProtocol,
  type TelemetryReceiver,
} from '@/domain/models/app/automations/trigger/webhook-telemetry-service'
import {
  markIngestRequest,
  outsideIngestScope,
  runInIngestScope,
} from '@/infrastructure/logging/ingest-request-scope'
import { logError } from '@/infrastructure/logging/logger'
import { provideDomain, runDomainPromise } from '@/infrastructure/logging/request-effect'
import { getRequestRateLimitKey } from '@/presentation/api/middleware/client-ip'
import { toErrorResponse } from '@/presentation/api/runtime/run-effect'
import {
  ingestBodyLimitBytes,
  readIngestBody,
  type IngestBodyRefusal,
} from './telemetry-ingest-body'
import { isKeyKnown, projectMatchesPath, resolveWebhookProject } from './webhook-project-key'
import { isIngestRateLimited, recordRefusal, refusalBudgetSpent } from './webhook-rate-limit'
import {
  ingestMalformed,
  ingestTooLarge,
  ingestUnsupportedEncoding,
  webhookNotFound,
  webhookRateLimited,
  webhookUnauthorized,
} from './webhook-refusals'
import type {
  IngestProject,
  IngestProjectSource,
} from '@/application/use-cases/automations/find-ingest-project'
import type { TriggerData } from '@/application/use-cases/automations/resolve-trigger-data'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Telemetry protocol ingest: the routes a webhook trigger declaring
 * `protocol` mounts (`sentry` at `/api/<project>/envelope/`, `otlp-logs` at
 * `/v1/logs`).
 *
 * The order is the contract, and it is chosen so an unauthenticated flood
 * costs as little as possible:
 *
 *   1. the receivers of the protocol, from the configuration alone (none:
 *      404, as for any unmounted path);
 *   2. the key, from the request's credential, looked up BEFORE the body is
 *      read — a missing key, an unknown key, and (Sentry) a key whose sender
 *      does not match the path all answer the SAME 401, so no answer tells
 *      which keys or projects exist. A missing key is refused before any
 *      database read, and an unknown key is remembered (`webhook-project-key.ts`).
 *      A missing or unknown key counts against the address's refusal budget
 *      (`refusalBudgetSpent`), past which it answers 429 + Retry-After — and a
 *      key not found in the last ten minutes, from such an address, is
 *      answered 429 without being looked up. A key found in that time is
 *      never counted nor refused by that budget;
 *   3. the paused automations, read only once a key is accepted (every
 *      accepted receiver paused: 404);
 *   4. the sender's own budget, counted once per request (429 + Retry-After);
 *   5. the body: its encoding (415), its size on the wire (counted as it
 *      arrives) and decoded against `API_BODY_LIMIT_BYTES` (413), then ONE
 *      parse (400) — see `telemetry-ingest-body.ts`;
 *   6. one run per receiver and item (Sentry) or per receiver (OTLP), handed
 *      to the dispatcher, and `200 {}` WITHOUT waiting for them.
 *
 * Nothing about the request is recorded on the run beyond the decoded payload
 * and the sender's id: no header, no query parameter, so the key never enters
 * a run. The request is marked as ingest and served inside the ingest scope,
 * so neither a transaction nor an error of it is reported to the app's own
 * error tracking; the runs it starts are dispatched outside that scope.
 */

/** A receiver whose key lookup found the sender. */
interface AcceptedReceiver extends TelemetryReceiver {
  readonly project: IngestProject
  readonly source: IngestProjectSource
}

type Gate<A> = { readonly pass: A } | { readonly response: Response }

const sourceOf = (receiver: TelemetryReceiver): IngestProjectSource | undefined => {
  const { auth } = receiver.trigger
  if (auth?.type !== 'projectKey' || auth.table === undefined || auth.keyField === undefined) {
    return undefined
  }
  return { table: auth.table, keyField: auth.keyField, projectField: auth.projectField }
}

/**
 * The receivers whose sender holds `key` (and, for Sentry, matches the path
 * segment). Receivers sharing one key table are looked up once.
 */
const acceptReceivers = async (
  c: Context,
  app: App,
  input: {
    readonly receivers: readonly TelemetryReceiver[]
    readonly key: string
    readonly segment: string | undefined
  }
): Promise<Gate<readonly AcceptedReceiver[]> | { readonly refused: 'unknown' | 'mismatch' }> => {
  const lookups = new Map<string, ReturnType<typeof resolveWebhookProject>>()
  const resolved = await Promise.all(
    input.receivers.map(async (receiver) => {
      const source = sourceOf(receiver)
      if (source === undefined) return { receiver, lookup: undefined }
      const id = JSON.stringify(source)
      const pending = lookups.get(id) ?? resolveWebhookProject(c, app, source, input.key)
      lookups.set(id, pending)
      return { receiver, source, lookup: await pending }
    })
  )
  const failed = resolved.find((entry) => entry.lookup?.status === 'failed')
  if (failed?.lookup?.status === 'failed') {
    return { response: toErrorResponse(c, failed.lookup.failure) }
  }
  const accepted = resolved.flatMap(({ receiver, source, lookup }) =>
    lookup?.status === 'found' &&
    source !== undefined &&
    (input.segment === undefined || projectMatchesPath(lookup.project, source, input.segment))
      ? [{ ...receiver, project: lookup.project, source }]
      : []
  )
  if (accepted.length > 0) return { pass: accepted }
  return {
    refused: resolved.some(({ lookup }) => lookup?.status === 'found') ? 'mismatch' : 'unknown',
  }
}

/**
 * A request no key admits — no key, or a key no row holds: the address's
 * refusal budget is checked, then counted. Past it, 429; otherwise the 401
 * every refusal shares.
 */
const refuse = (c: Context, app: App): Response => {
  const address = getRequestRateLimitKey(c)
  const spent = refusalBudgetSpent(app, address)
  if (spent.limited) return webhookRateLimited(c, spent.retryAfter)
  recordRefusal(app, address)
  return webhookUnauthorized(c)
}

/** Whether `key` was found, within the last ten minutes, for any of these receivers. */
const keyKnown = (app: App, receivers: readonly TelemetryReceiver[], key: string): boolean =>
  receivers.some((receiver) => {
    const source = sourceOf(receiver)
    return source !== undefined && isKeyKnown(app, source, key)
  })

/**
 * Gate 2: the receivers `key` admits. A key known from the last ten minutes is
 * looked up and refused, if at all, with the plain 401; any other key from an
 * address past its refusal budget is answered 429 without a lookup.
 */
const keyGate = async (
  c: Context,
  app: App,
  input: {
    readonly receivers: readonly TelemetryReceiver[]
    readonly key: string | undefined
    readonly segment: string | undefined
  }
): Promise<Gate<readonly AcceptedReceiver[]>> => {
  const { key } = input
  if (key === undefined) return { response: refuse(c, app) }
  const known = keyKnown(app, input.receivers, key)
  if (!known) {
    const spent = refusalBudgetSpent(app, getRequestRateLimitKey(c))
    if (spent.limited) return { response: webhookRateLimited(c, spent.retryAfter) }
  }
  const accepted = await acceptReceivers(c, app, { ...input, key })
  if (!('refused' in accepted)) return accepted
  return {
    response: accepted.refused === 'unknown' && !known ? refuse(c, app) : webhookUnauthorized(c),
  }
}

/** Gate 3: the accepted receivers whose automation is not paused (none: 404). */
const unpausedGate = async (
  c: Context,
  accepted: readonly AcceptedReceiver[]
): Promise<Gate<readonly AcceptedReceiver[]>> => {
  const pausedNames = await runDomainPromise(c, loadPausedAutomationNames)
  const running = accepted.filter((receiver) => !pausedNames.has(receiver.automation))
  return running.length === 0 ? { response: webhookNotFound(c) } : { pass: running }
}

/** The sender's budget, counted once for the request against the strictest receiver's. */
const budgetGate = (
  c: Context,
  app: App,
  protocol: TelemetryProtocol,
  accepted: readonly AcceptedReceiver[]
): Response | undefined => {
  const budget = strictestIngestBudget(accepted.map((receiver) => receiver.trigger))
  const [first] = accepted
  const counted =
    budget.per === 'ip' || first === undefined
      ? `ip:${getRequestRateLimitKey(c)}`
      : `project:${first.source.table}:${String(first.project.id)}`
  const limit = isIngestRateLimited(app, `${protocol}:${counted}`, budget)
  return limit.limited ? webhookRateLimited(c, limit.retryAfter) : undefined
}

const BODY_REFUSALS: Readonly<Record<IngestBodyRefusal, (c: Context) => Response>> = {
  'unsupported-encoding': ingestUnsupportedEncoding,
  'too-large': ingestTooLarge,
  malformed: ingestMalformed,
}

/** The decoded body once its encoding and both of its sizes are accepted, or the refusal. */
const readBody = async (c: Context): Promise<Gate<Uint8Array>> => {
  const body = await readIngestBody(c.req.raw, ingestBodyLimitBytes())
  return 'refusal' in body ? { response: BODY_REFUSALS[body.refusal](c) } : { pass: body.bytes }
}

/**
 * Start one run, after the answer and outside the ingest scope: it is an
 * ordinary run, and its failure is reported like any run's.
 */
const dispatchRun = (c: Context, app: App, receiver: AcceptedReceiver, body: unknown): void => {
  const triggerData: TriggerData = { body, project: receiver.project }
  const program = runWebhookAutomation({
    name: receiver.automation,
    app,
    processEnv: process.env,
    triggerData,
  })
  outsideIngestScope(() => {
    Effect.runPromise(Effect.result(provideDomain(c, program))).then(
      (result) => {
        if (result._tag === 'Failure') {
          logError('[automation] telemetry ingest run failed', result.failure)
        }
      },
      (error) => logError('[automation] telemetry ingest run rejected', error)
    )
  })
}

/** Gates 1–5 shared by both protocols; answers the accepted receivers and the body. */
const runIngestGates = async (
  c: Context,
  app: App,
  input: {
    readonly protocol: TelemetryProtocol
    readonly key: string | undefined
    readonly segment: string | undefined
  }
): Promise<Gate<{ readonly accepted: readonly AcceptedReceiver[]; readonly body: Uint8Array }>> => {
  const receivers = telemetryReceivers(app.automations, input.protocol, new Set())
  if (receivers.length === 0) return { response: webhookNotFound(c) }
  const keyed = await keyGate(c, app, { receivers, key: input.key, segment: input.segment })
  if ('response' in keyed) return keyed
  const accepted = await unpausedGate(c, keyed.pass)
  if ('response' in accepted) return accepted
  const limited = budgetGate(c, app, input.protocol, accepted.pass)
  if (limited !== undefined) return { response: limited }
  const body = await readBody(c)
  if ('response' in body) return body
  return { pass: { accepted: accepted.pass, body: body.pass } }
}

/** Serve one ingest request, marked and inside the ingest scope. */
const serveIngest = (c: Context, serve: () => Promise<Response>): Promise<Response> => {
  markIngestRequest(c.req.raw)
  return runInIngestScope(async () => {
    try {
      return await serve()
    } catch (error) {
      return toErrorResponse(c, error)
    }
  })
}

/** `POST /api/<project>/envelope/` — a Sentry envelope, one run per item and receiver. */
export const handleSentryEnvelope = (c: Context, app: App): Promise<Response> =>
  serveIngest(c, async () => {
    const gate = await runIngestGates(c, app, {
      protocol: 'sentry',
      key: sentryKeyOf({
        sentryAuthHeader: c.req.header('x-sentry-auth'),
        authorizationHeader: c.req.header('authorization'),
        queryKey: c.req.query('sentry_key'),
      }),
      segment: c.req.param('project') ?? '',
    })
    if ('response' in gate) return gate.response
    const envelope = parseSentryEnvelope(gate.pass.body)
    if (envelope === undefined) return ingestMalformed(c)
    const now = Date.now()
    envelope.items.forEach((item) => {
      const data = normaliseSentryItem(item, now)
      gate.pass.accepted
        .filter((receiver) => receivesItemKind(receiver.trigger, item.kind))
        .forEach((receiver) => dispatchRun(c, app, receiver, data))
    })
    return c.json({}, 200)
  })

const parseJsonBytes = (bytes: Uint8Array): unknown => {
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    return undefined
  }
}

/** `POST /v1/logs` — an OTLP/HTTP JSON logs request, one run per receiver. */
export const handleOtlpLogs = (c: Context, app: App): Promise<Response> =>
  serveIngest(c, async () => {
    const gate = await runIngestGates(c, app, {
      protocol: 'otlp-logs',
      key: bearerKeyOf(c.req.header('authorization')),
      segment: undefined,
    })
    if ('response' in gate) return gate.response
    const request = decodeOtlpLogsRequest(parseJsonBytes(gate.pass.body))
    if (request === undefined) return ingestMalformed(c)
    const data = normaliseOtlpLogs(request, Date.now())
    gate.pass.accepted.forEach((receiver) => dispatchRun(c, app, receiver, data))
    return c.json({}, 200)
  })
