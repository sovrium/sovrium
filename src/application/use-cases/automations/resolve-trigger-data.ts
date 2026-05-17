/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderTemplate } from '@/infrastructure/templates/template-engine'
import { mapStringsDeep } from './value-walker'

/**
 * Trigger data accessible to a running automation through `{{trigger.data.X}}`
 * template references.
 *
 * For webhook triggers, `body` carries the parsed request body and
 * `headers`/`query` carry the inbound HTTP context. The shape mirrors the
 * convention established by spec 1's environment-variables tests and the
 * existing template-helpers spec (`{{trigger.data.body.name}}`).
 */
export interface TriggerData {
  readonly body?: unknown
  readonly headers?: Readonly<Record<string, unknown>>
  readonly query?: Readonly<Record<string, unknown>>
  /**
   * HTTP method of the request that fired the webhook trigger. Surfaced for
   * `{{trigger.data.method}}` templating in webhook handlers
   * (APP-AUTOMATION-TRIGGER-WEBHOOK-017).
   */
  readonly method?: string
  /**
   * Request path including query string. Surfaced for `{{trigger.data.path}}`
   * templating so handlers can log or branch on the original URL.
   */
  readonly path?: string
  /**
   * Client IP address (best-effort: parsed from `x-forwarded-for` or falls
   * back to localhost). Useful for audit-log fields and per-IP routing
   * decisions inside the automation.
   */
  readonly ip?: string
  /** Optional input payload (used by manual / automation-call triggers). */
  readonly input?: unknown
  /**
   * Name of the automation that invoked this one via an `automation:call`
   * action. Surfaces at `{{trigger.caller}}`. Undefined for non-called runs.
   */
  readonly caller?: string
  /**
   * Current call-stack depth (1 for the first `automation:call` hop).
   * Surfaces at `{{trigger.depth}}`. Undefined for non-called runs.
   */
  readonly depth?: number
  /**
   * Trigger kind discriminator used by system-triggered runs (cron) so handler
   * templates can distinguish a scheduled fire from an HTTP-driven one via
   * `{{trigger.data.type}}`. Webhook/manual triggers leave this undefined —
   * their kind is implicit from the route they entered through.
   */
  readonly type?: string
  /**
   * ISO-8601 timestamp at which the cron scheduler observed the fire and
   * synthesised this envelope. Surfaced for `{{trigger.data.firedAt}}` and
   * persisted to `system.automation_runs.trigger_data` so operators can audit
   * scheduled runs after the fact.
   */
  readonly firedAt?: string
  /**
   * Single record payload emitted by record-event triggers (create / update
   * / delete). Surfaces as `{{trigger.data.record.<field>}}` so action props
   * can reference the row that fired the trigger — most commonly its `id`,
   * to update the same row back through a `record/update` action.
   */
  readonly record?: Readonly<Record<string, unknown>>
  /**
   * Pre-mutation snapshot of the row, populated only for `update` events.
   * Lets templates compare new vs old values via
   * `{{trigger.data.previousRecord.<field>}}`. Undefined for create/delete.
   */
  readonly previousRecord?: Readonly<Record<string, unknown>>
  /**
   * Plural form used by batch operations (`{{trigger.data.records}}`).
   * Currently asserted by the batch-create/update/upsert/delete spec
   * fixtures; the field is reserved here so the substitution context
   * surfaces it without per-trigger ENVELOPE allowlist edits.
   */
  readonly records?: ReadonlyArray<Readonly<Record<string, unknown>>>
  /**
   * Comment payload emitted by the comment-posted trigger (Y-6). Surfaces at
   * `{{trigger.comment.X}}` (NOT `{{trigger.data.comment.X}}`) so spec
   * authors can read fields like `comment.parentCommentId`,
   * `comment.author.email`, and `comment.body` directly.
   */
  readonly comment?: Readonly<Record<string, unknown>>
  /**
   * Distinct user IDs of every prior comment author on the same record,
   * EXCLUDING the comment that just fired the trigger. Surfaces at
   * `{{trigger.threadParticipants}}`. Used by notification automations to
   * fan out to thread members without notifying the new author back.
   */
  readonly threadParticipants?: readonly string[]
  /**
   * User IDs mentioned via `@<name>` markup in the comment body. The
   * caller passes the already-resolved IDs (the engine does not re-parse
   * the body string). Surfaces at `{{trigger.mentions}}`.
   */
  readonly mentions?: readonly string[]
}

/**
 * Pattern that matches simple template variables of the form
 * `{{path.to.value}}`. We deliberately do NOT handle helpers
 * (`{{uppercase trigger.data.body.x}}`) here — those are owned by the
 * full template engine landing in a later migration spec. This helper
 * only resolves the bare-variable case the current specs depend on.
 */
const SIMPLE_TEMPLATE_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g

const lookupPath = (context: Readonly<Record<string, unknown>>, path: string): unknown => {
  const segments = path.split('.')
  return segments.reduce<unknown>((acc, segment) => {
    if (acc === undefined || acc === null) return undefined
    if (typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[segment]
  }, context)
}

const formatValue = (value: unknown): string => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  // Object/array values are intentionally left as their default `toString`
  // representation. The current spec only references scalar leaves
  // (`{{trigger.data.body.customer}}` → string); when a future migration
  // spec requires inlining structured data, a dedicated stringifier
  // (Effect Schema-aware) will land alongside the helper that needs it.
  return String(value)
}

/**
 * Resolve template references in a single string against the automation
 * context.
 *
 * Two layers of substitution are supported, in order of priority:
 *
 *   1. Handlebars helpers + path lookups (`{{uppercase trigger.data.body.x}}`,
 *      `{{add a b}}`, `{{trigger.data.body.foo}}`) — full template engine,
 *      see `infrastructure/templates/template-engine.ts`.
 *   2. Legacy bare-path fallback (`{{path.to.value}}`) — kept as a defensive
 *      net for backwards compatibility with the old regex resolver.
 *
 * Both engines treat unknown paths as the empty string, so the public
 * contract that webhook/trigger specs depend on is preserved.
 */
export const resolveTriggerInString = (
  input: string,
  context: Readonly<Record<string, unknown>>
): string => {
  // Fast path: no `{{...}}` at all → return as-is. Avoids paying the
  // compile/regex cost on the (overwhelmingly common) literal-string case.
  if (!input.includes('{{')) return input
  const rendered = renderTemplate(input, context)
  // If Handlebars failed to compile (renderTemplate returns the input
  // unchanged on error), fall through to the legacy path-only resolver
  // so existing `{{trigger.data.X}}` substitutions keep working.
  if (rendered !== input) return rendered
  return input.replace(SIMPLE_TEMPLATE_PATTERN, (_match, path: string) =>
    formatValue(lookupPath(context, path))
  )
}

/**
 * Recursively walk a value and resolve `{{path.to.value}}` references in
 * any string leaves. The structural traversal is owned by `mapStringsDeep`,
 * which `resolveEnvInValue` also uses — the two passes compose cleanly.
 */
export const resolveTriggerInValue = (
  value: unknown,
  context: Readonly<Record<string, unknown>>
): unknown => mapStringsDeep(value, (s) => resolveTriggerInString(s, context))

/**
 * Build the substitution context an action sees during a run.
 *
 * For webhook triggers, `triggerData.body` is the parsed request body and
 * its scalar fields are flattened into `trigger.data.X` so
 * `{{trigger.data.userId}}` resolves the same way as
 * `context.trigger.data.userId` inside a code action's sandbox
 * (`buildCodeTriggerView`). All other keys on `triggerData` (the HTTP
 * envelope keys `headers`/`query`/`method`/… for webhook, `record` /
 * `previousRecord` for record-event triggers, `firedAt` for cron, etc.)
 * are passed through verbatim so `{{trigger.data.record.id}}`,
 * `{{trigger.data.headers.x}}`, etc. all resolve. Flattened body fields
 * win on key collision (consistent with `context.trigger.data.X` in the
 * code sandbox).
 *
 * The pass-through is dynamic (uses `Object.keys(triggerData)`) rather
 * than a hardcoded allowlist so adding a new trigger type does not
 * require touching this builder — the previous allowlist regressed the
 * record-event trigger when it was introduced because `record` was not
 * on it (the value substituted to the empty string and downstream filters
 * matched zero rows).
 *
 * Future migration specs will extend this place with step outputs
 * (`{{step1.X}}`) and loop variables (`{{loop.item.X}}`).
 */
export const buildAutomationContext = (
  triggerData: TriggerData
): Readonly<Record<string, unknown>> => {
  const td = triggerData as Readonly<Record<string, unknown>>
  const { body } = td
  const fromBody: Record<string, unknown> =
    body !== undefined && body !== null && typeof body === 'object'
      ? { ...(body as Record<string, unknown>) }
      : {}
  // Pass through every non-body key on triggerData. `body` itself is also
  // re-exposed (so `{{trigger.data.body.X}}` keeps working) — only its
  // already-flattened scalar children would otherwise duplicate.
  const envelopeAdditions = Object.fromEntries(
    Object.keys(td)
      .filter((key) => td[key] !== undefined && !(key in fromBody))
      .map((key) => [key, td[key]] as const)
  )
  // Top-level keys exposed at `trigger.X` (in addition to `trigger.data.X`)
  // for triggers whose specs assert paths like `{{trigger.comment.X}}` and
  // `{{trigger.threadParticipants}}` — i.e. the Y-6 comment-posted trigger.
  // The pass-through is intentionally narrow (an explicit allowlist) so
  // legacy specs that read `{{trigger.data.X}}` continue to be the
  // canonical path for the rest of the trigger families.
  // `input` / `caller` / `depth` join the comment keys here: the
  // automation-call trigger's specs read `{{trigger.input.X}}`,
  // `{{trigger.caller}}`, `{{trigger.depth}}` (NOT `{{trigger.data.X}}`).
  const TOPLEVEL_KEYS = [
    'comment',
    'threadParticipants',
    'mentions',
    'input',
    'caller',
    'depth',
  ] as const
  const triggerTopLevel = Object.fromEntries(
    TOPLEVEL_KEYS.filter((key) => td[key] !== undefined).map((key) => [key, td[key]] as const)
  )
  return {
    trigger: {
      data: { ...fromBody, ...envelopeAdditions },
      ...triggerTopLevel,
    },
  }
}
