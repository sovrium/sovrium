/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** The hmac schemes that sign a timestamp and fix their own headers. */
const TIMESTAMPED_SCHEMES: ReadonlySet<string> = new Set(['stripe', 'slack', 'svix'])

/** Properties a named scheme fixes itself, and so refuses beside it. */
const FIXED_BY_SCHEME = ['header', 'prefix', 'algorithm'] as const

interface WebhookAuthLike {
  readonly type?: string
  readonly scheme?: string
  readonly tolerance?: number
  readonly header?: string
  readonly prefix?: string
  readonly algorithm?: string
}

/**
 * Check an incoming webhook's `hmac` auth for properties its `scheme` would
 * silently ignore: `header`, `prefix` or `algorithm` beside a named scheme
 * (stripe, slack, svix), or `tolerance` beside `hex`/`base64`, which sign no
 * timestamp. Returns a message naming the automation and the property, or
 * `true` when the combination is coherent.
 */
export const validateWebhookSignatureScheme = (
  automationName: string,
  trigger: { readonly type: string; readonly auth?: WebhookAuthLike }
): true | string => {
  if (trigger.type !== 'webhook' || trigger.auth?.type !== 'hmac') return true
  const { auth } = trigger
  const scheme = auth.scheme ?? 'hex'
  if (TIMESTAMPED_SCHEMES.has(scheme)) {
    const fixed = FIXED_BY_SCHEME.find((property) => auth[property] !== undefined)
    return fixed === undefined
      ? true
      : `Automation '${automationName}': the '${scheme}' signature scheme fixes its own ${fixed}; remove '${fixed}' from the webhook auth`
  }
  return auth.tolerance === undefined
    ? true
    : `Automation '${automationName}': 'tolerance' applies only to the stripe, slack and svix signature schemes, not to '${scheme}'`
}
