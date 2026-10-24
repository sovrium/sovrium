/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

interface SessionWebhookAppLike {
  readonly auth?: unknown
  readonly automations?: ReadonlyArray<{
    readonly name: string
    readonly triggers: ReadonlyArray<{
      readonly type: string
      readonly auth?: { readonly type?: string }
    }>
  }>
}

/**
 * A webhook with `auth: { type: 'session' }` admits only a signed-in caller,
 * so in an app that declares no `auth` nobody could ever call it. Returns a
 * message naming the first such automation, or `true`.
 */
export const validateSessionWebhookAuth = (app: SessionWebhookAppLike): true | string => {
  if (app.auth !== undefined) return true
  const sessionWebhook = app.automations?.find((automation) =>
    automation.triggers.some(
      (trigger) => trigger.type === 'webhook' && trigger.auth?.type === 'session'
    )
  )
  return sessionWebhook === undefined
    ? true
    : `Automation '${sessionWebhook.name}': a webhook with auth type 'session' admits only signed-in callers and requires auth configuration`
}

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Every step reachable from `value`, through branches and loops. */
function stepsOf(value: unknown): readonly RawRecord[] {
  if (Array.isArray(value)) return value.flatMap(stepsOf)
  if (!isRecord(value)) return []
  const props = isRecord(value['props']) ? value['props'] : {}
  const nested = [value['actions'], value['paths'], props['actions'], props['paths']].flatMap(
    stepsOf
  )
  return [value, ...nested]
}

/**
 * The directive names of a `Cache-Control` value, lower-cased. A comma inside a
 * quoted argument (`no-cache="Set-Cookie, public"`) separates nothing, so a
 * word quoted there is never read as a directive.
 */
const directiveNamesOf = (value: string): readonly string[] =>
  (value.match(/(?:[^,"]|"(?:[^"\\]|\\.)*"?)+/g) ?? []).map((directive) =>
    directive.split('=')[0]!.trim().toLowerCase()
  )

/** The `Cache-Control` values of a headers map that invite a shared cache, as written. */
function sharedCacheDirectives(headers: unknown): readonly string[] {
  if (!isRecord(headers)) return []
  return Object.entries(headers).flatMap(([name, value]) => {
    if (name.toLowerCase() !== 'cache-control' || typeof value !== 'string') return []
    const shared = directiveNamesOf(value).some(
      (directive) => directive === 'public' || directive === 's-maxage'
    )
    return shared ? [value] : []
  })
}

/** The triggers of a raw automation, under `trigger` or `triggers`. */
const triggersOf = (automation: RawRecord): readonly RawRecord[] =>
  [
    automation['trigger'],
    ...(Array.isArray(automation['triggers']) ? automation['triggers'] : []),
  ].filter(isRecord)

const isSessionWebhook = (trigger: RawRecord): boolean =>
  trigger['type'] === 'webhook' &&
  isRecord(trigger['auth']) &&
  trigger['auth']['type'] === 'session'

/**
 * A webhook behind `auth: { type: 'session' }` answers for the person who
 * asked. An answer declaring `Cache-Control` with `public` or `s-maxage` lets
 * a shared cache keep it and serve it to the next caller. Returns one warning
 * per such answer — a `webhook/response` step (through branches and loops) or
 * the session trigger's own `response.headers` — never a refusal. Headers are
 * read as written: a templated value is not resolved. Runs over the RAW
 * config, so `validate` and `start` judge the same text. Pure.
 */
export function sessionWebhookCacheWarnings(config: unknown): readonly string[] {
  if (!isRecord(config) || !Array.isArray(config['automations'])) return []
  return config['automations'].filter(isRecord).flatMap((automation) => {
    const sessionTriggers = triggersOf(automation).filter(isSessionWebhook)
    if (sessionTriggers.length === 0) return []
    const responseHeaders = stepsOf(automation['actions'])
      .filter((step) => step['type'] === 'webhook' && step['operator'] === 'response')
      .map((step) => (isRecord(step['props']) ? step['props']['headers'] : undefined))
    const triggerHeaders = sessionTriggers.map((trigger) =>
      isRecord(trigger['response']) ? trigger['response']['headers'] : undefined
    )
    const name = String(automation['name'] ?? '(unnamed)')
    return [...triggerHeaders, ...responseHeaders]
      .flatMap(sharedCacheDirectives)
      .map(
        (value) =>
          `Automation '${name}': its session webhook answers with Cache-Control '${value}', which lets a shared cache serve one caller's answer to another; declare 'private'`
      )
  })
}
