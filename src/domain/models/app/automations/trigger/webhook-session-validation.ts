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
    readonly trigger: { readonly type: string; readonly auth?: { readonly type?: string } }
  }>
}

/**
 * A webhook with `auth: { type: 'session' }` admits only a signed-in caller,
 * so in an app that declares no `auth` nobody could ever call it. Returns a
 * message naming the first such automation, or `true`.
 */
export const validateSessionWebhookAuth = (app: SessionWebhookAppLike): true | string => {
  if (app.auth !== undefined) return true
  const sessionWebhook = app.automations?.find(
    (automation) =>
      automation.trigger.type === 'webhook' && automation.trigger.auth?.type === 'session'
  )
  return sessionWebhook === undefined
    ? true
    : `Automation '${sessionWebhook.name}': a webhook with auth type 'session' admits only signed-in callers and requires auth configuration`
}
