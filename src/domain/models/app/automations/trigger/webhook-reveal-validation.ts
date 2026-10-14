/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Load-time rules for `revealWriteOnly` on a webhook trigger: the one road by
 * which a write-only value leaves the server in an answer.
 *
 * Two families of refusal, each naming the automation and the option:
 *
 * - **who may receive it** — only a webhook that authenticates a machine:
 *   `session` with a `requiredRole` other than the role every sign-up
 *   receives (any user who mints a key would otherwise read the secret),
 *   `bearer` or `apiKey`. No auth, `hmac` (a signature
 *   proves who wrote a body, not who reads the answer), `basic` (a browser
 *   keeps it, so it is a person's credential as often as a machine's) and
 *   `projectKey` (the public half of a telemetry DSN) are refused, and so is
 *   `respondImmediately`, which answers before any step has read anything;
 * - **what it names** — each entry is `table.field`, a table of the app and a
 *   field of it declaring `writeOnly: true`.
 */

interface RevealTriggerLike {
  readonly type: string
  readonly auth?: { readonly type?: string; readonly requiredRole?: string }
  readonly respondImmediately?: boolean
  readonly revealWriteOnly?: ReadonlyArray<string>
}

interface RevealAppLike {
  readonly auth?: { readonly defaultRole?: string } | undefined
  readonly tables?: ReadonlyArray<{
    readonly name: string
    readonly fields: ReadonlyArray<{ readonly name: string; readonly writeOnly?: unknown }>
  }>
  readonly automations?: ReadonlyArray<{
    readonly name: string
    readonly triggers: ReadonlyArray<RevealTriggerLike>
  }>
}

/** The auth types that authenticate a machine on their own. */
const MACHINE_AUTH_TYPES: ReadonlySet<string> = new Set(['bearer', 'apiKey'])

/** The role every new sign-up receives, as the auth instance hands it out. */
const signUpRoleOf = (app: RevealAppLike): string => app.auth?.defaultRole ?? 'member'

/** Why a `session` webhook's `requiredRole` does not single out a machine, or `undefined`. */
const sessionRoleIssue = (
  app: RevealAppLike,
  requiredRole: string | undefined
): string | undefined => {
  if (requiredRole === undefined) {
    return "needs a requiredRole beside auth type 'session', or any signed-in user holding a key would read the value"
  }
  return requiredRole === signUpRoleOf(app)
    ? `cannot require role '${requiredRole}', the auth.defaultRole every new sign-up receives: anyone who signs up and mints a key would read the value`
    : undefined
}

/** Why this trigger's caller is not a machine the option may answer, or `undefined`. */
const callerIssue = (app: RevealAppLike, trigger: RevealTriggerLike): string | undefined => {
  if (trigger.respondImmediately === true) {
    return 'cannot be set beside respondImmediately, which answers before any step reads a value'
  }
  const type = trigger.auth?.type
  if (type === undefined) {
    return "needs a webhook that authenticates a machine: auth type 'session' with a requiredRole, 'bearer' or 'apiKey'"
  }
  if (type === 'session') return sessionRoleIssue(app, trigger.auth?.requiredRole)
  return MACHINE_AUTH_TYPES.has(type)
    ? undefined
    : `is refused beside auth type '${type}', which does not authenticate a machine reading the answer: use 'session' with a requiredRole, 'bearer' or 'apiKey'`
}

/** Why one `table.field` entry does not name a write-only field of the app, or `undefined`. */
const entryIssue = (app: RevealAppLike, entry: string): string | undefined => {
  const dot = entry.indexOf('.')
  if (dot <= 0) return `entry '${entry}' must name a field as table.field`
  const tableName = entry.slice(0, dot)
  const fieldName = entry.slice(dot + 1)
  const table = app.tables?.find((candidate) => candidate.name === tableName)
  if (table === undefined)
    return `entry '${entry}' names table '${tableName}', which does not exist`
  const field = table.fields.find((candidate) => candidate.name === fieldName)
  if (field === undefined) {
    return `entry '${entry}' names field '${fieldName}', which does not exist in table '${tableName}'`
  }
  return field.writeOnly === true
    ? undefined
    : `entry '${entry}' is not a write-only field: only a field declaring writeOnly: true can be revealed`
}

/** The first issue of one trigger's `revealWriteOnly`, or `undefined`. */
const triggerIssue = (app: RevealAppLike, trigger: RevealTriggerLike): string | undefined => {
  const entries = trigger.revealWriteOnly
  if (trigger.type !== 'webhook' || entries === undefined) return undefined
  return callerIssue(app, trigger) ?? entries.map((entry) => entryIssue(app, entry)).find(Boolean)
}

/**
 * Every `revealWriteOnly` must sit on a webhook that authenticates a machine
 * and name only write-only fields of the app. Returns a message naming the
 * first automation at fault, `revealWriteOnly`, and the entry or the auth
 * setting refused — or `true`.
 */
export const validateRevealWriteOnly = (app: RevealAppLike): true | string => {
  const found = (app.automations ?? [])
    .flatMap((automation) =>
      automation.triggers.map((trigger) => ({
        automation: automation.name,
        issue: triggerIssue(app, trigger),
      }))
    )
    .find((candidate) => candidate.issue !== undefined)
  return found === undefined
    ? true
    : `Automation '${found.automation}': revealWriteOnly ${found.issue ?? ''}`
}
