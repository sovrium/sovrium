/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Load-time rules for a webhook trigger that receives a telemetry protocol.
 *
 * A protocol fixes its own paths, body, answer and credential, so the
 * properties that configure those on an ordinary webhook are refused beside
 * it rather than silently ignored — an operator reading the config must not
 * believe in a check that never runs. Two entry points:
 *
 * - {@link validateWebhookTelemetryTrigger}: the rules one trigger can judge
 *   on its own (wired into the automation schema);
 * - {@link validateTelemetryProjectReferences}: the `projectKey` table and
 *   fields, which need the app's tables (wired into the app schema).
 */

interface TelemetryAuthLike {
  readonly type?: string
  readonly table?: string
  readonly keyField?: string
  readonly projectField?: string
}

interface TelemetryTriggerLike {
  readonly type: string
  readonly protocol?: string
  readonly items?: ReadonlyArray<string>
  readonly method?: string | ReadonlyArray<string>
  readonly auth?: TelemetryAuthLike
  readonly rateLimit?: { readonly per?: string }
  readonly respondImmediately?: unknown
  readonly response?: unknown
  readonly requestSchema?: unknown
  readonly querySchema?: unknown
  readonly deduplicationKey?: unknown
  readonly verification?: unknown
}

/** Properties a protocol fixes itself, and so refuses beside it. */
const FIXED_BY_PROTOCOL = [
  'respondImmediately',
  'response',
  'requestSchema',
  'querySchema',
  'deduplicationKey',
  'verification',
] as const

/** The properties only a `projectKey` auth reads. */
const PROJECT_KEY_PROPERTIES = ['table', 'keyField', 'projectField'] as const

const isPostOnly = (method: TelemetryTriggerLike['method']): boolean =>
  method === undefined ||
  method === 'POST' ||
  (Array.isArray(method) && method.length > 0 && method.every((m) => m === 'POST'))

/**
 * The rules that hold whether or not the trigger declares a protocol, each a
 * condition that is wrong and the message naming it. The first that holds wins.
 */
const KEY_AUTH_RULES: ReadonlyArray<{
  readonly holds: (trigger: TelemetryTriggerLike, isProjectKey: boolean) => boolean
  readonly message: (trigger: TelemetryTriggerLike) => string
}> = [
  {
    holds: (trigger, isProjectKey) => isProjectKey && trigger.protocol === undefined,
    message: () => "auth type 'projectKey' needs a 'protocol' on the webhook trigger",
  },
  {
    holds: (trigger, isProjectKey) =>
      !isProjectKey && strayProjectKeyProperty(trigger) !== undefined,
    message: (trigger) =>
      `'${strayProjectKeyProperty(trigger) ?? ''}' applies only to auth type 'projectKey'`,
  },
  {
    holds: (trigger, isProjectKey) => !isProjectKey && trigger.rateLimit?.per === 'project',
    message: () => "rateLimit 'per: project' needs auth type 'projectKey'",
  },
  {
    holds: (trigger) => trigger.protocol !== 'sentry' && trigger.items !== undefined,
    message: () => "'items' applies only to protocol 'sentry'",
  },
]

const strayProjectKeyProperty = (trigger: TelemetryTriggerLike): string | undefined =>
  PROJECT_KEY_PROPERTIES.find((property) => trigger.auth?.[property] !== undefined)

const keyAuthIssue = (automationName: string, trigger: TelemetryTriggerLike): true | string => {
  const isProjectKey = trigger.auth?.type === 'projectKey'
  const broken = KEY_AUTH_RULES.find((rule) => rule.holds(trigger, isProjectKey))
  return broken === undefined ? true : `Automation '${automationName}': ${broken.message(trigger)}`
}

/** The rules a protocol trigger adds. */
const protocolIssue = (
  automationName: string,
  trigger: TelemetryTriggerLike,
  protocol: string
): true | string => {
  if (trigger.auth?.type !== 'projectKey') {
    return `Automation '${automationName}': protocol '${protocol}' needs auth type 'projectKey'`
  }
  if (trigger.auth.table === undefined || trigger.auth.keyField === undefined) {
    return `Automation '${automationName}': auth type 'projectKey' needs 'table' and 'keyField'`
  }
  if (protocol !== 'sentry' && trigger.auth.projectField !== undefined) {
    return `Automation '${automationName}': 'projectField' applies only to protocol 'sentry'`
  }
  if (!isPostOnly(trigger.method)) {
    return `Automation '${automationName}': protocol '${protocol}' receives POST only, so 'method' must be POST`
  }
  const fixed = FIXED_BY_PROTOCOL.find((property) => trigger[property] !== undefined)
  return fixed === undefined
    ? true
    : `Automation '${automationName}': '${fixed}' cannot be set beside protocol '${protocol}', which fixes its own answer and body`
}

/**
 * Judge one trigger. Returns a message naming the automation and the property
 * at fault, or `true`. Non-webhook triggers always pass.
 */
export const validateWebhookTelemetryTrigger = (
  automationName: string,
  trigger: TelemetryTriggerLike
): true | string => {
  if (trigger.type !== 'webhook') return true
  const keyVerdict = keyAuthIssue(automationName, trigger)
  if (keyVerdict !== true) return keyVerdict
  return trigger.protocol === undefined
    ? true
    : protocolIssue(automationName, trigger, trigger.protocol)
}

interface TelemetryAppLike {
  readonly tables?: ReadonlyArray<{
    readonly name: string
    readonly fields: ReadonlyArray<{ readonly name: string }>
  }>
  readonly automations?: ReadonlyArray<{
    readonly name: string
    readonly triggers: ReadonlyArray<TelemetryTriggerLike>
  }>
}

/** The first table or field a `projectKey` names that the app does not have. */
const referenceIssue = (
  automationName: string,
  auth: TelemetryAuthLike,
  fieldsByTable: ReadonlyMap<string, ReadonlySet<string>>
): true | string => {
  if (auth.table === undefined) return true
  const fields = fieldsByTable.get(auth.table)
  if (fields === undefined) {
    return `Automation '${automationName}': auth 'table' references table '${auth.table}' which does not exist`
  }
  const missing = (['keyField', 'projectField'] as const).find(
    (property) => auth[property] !== undefined && !fields.has(auth[property] ?? '')
  )
  return missing === undefined
    ? true
    : `Automation '${automationName}': auth '${missing}' references field '${auth[missing] ?? ''}' which does not exist in table '${auth.table}'`
}

/**
 * Every `projectKey` must name a table of the app, and `keyField` /
 * `projectField` must be fields of that table. A misspelt name would
 * otherwise answer every client 401 at runtime with nothing pointing at the
 * config. Returns the first issue, or `true`.
 */
export const validateTelemetryProjectReferences = (app: TelemetryAppLike): true | string => {
  const fieldsByTable: ReadonlyMap<string, ReadonlySet<string>> = new Map(
    (app.tables ?? []).map((table) => [table.name, new Set(table.fields.map((f) => f.name))])
  )
  return (app.automations ?? []).reduce<true | string>(
    (verdict, automation) =>
      verdict !== true
        ? verdict
        : automation.triggers.reduce<true | string>(
            (inner, trigger) =>
              inner !== true || trigger.type !== 'webhook' || trigger.auth?.type !== 'projectKey'
                ? inner
                : referenceIssue(automation.name, trigger.auth, fieldsByTable),
            true
          ),
    true
  )
}
