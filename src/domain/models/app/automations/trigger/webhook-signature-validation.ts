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

/** Properties `hmac-timestamp` fixes itself: the signature is always lowercase hex SHA-256. */
const FIXED_BY_HMAC_TIMESTAMP = ['prefix', 'algorithm'] as const

interface WebhookAuthLike {
  readonly type?: string
  readonly scheme?: string
  readonly tolerance?: number
  readonly header?: string
  readonly prefix?: string
  readonly algorithm?: string
  readonly format?: string
  readonly timestampKey?: string
  readonly signatureKey?: string
  readonly separator?: string
  readonly join?: string
}

/** The properties that describe an `hmac-timestamp` layout, read by no other scheme. */
const LAYOUT_PROPERTIES = ['format', 'timestampKey', 'signatureKey', 'separator', 'join'] as const

/** The properties that spell a layout out key by key, instead of a `format` preset. */
const SPELLED_OUT_PROPERTIES = ['timestampKey', 'signatureKey', 'separator', 'join'] as const

/**
 * A layout is named exactly once: a `format` preset, or `timestampKey` and
 * `signatureKey` together (with `separator` and `join` refining only them).
 */
const layoutIssue = (automationName: string, auth: WebhookAuthLike): true | string => {
  const spelled = SPELLED_OUT_PROPERTIES.find((property) => auth[property] !== undefined)
  if (auth.format !== undefined) {
    return spelled === undefined
      ? true
      : `Automation '${automationName}': give the hmac-timestamp layout once — 'format' or '${spelled}', not both`
  }
  const keys = (['timestampKey', 'signatureKey'] as const).filter(
    (property) => auth[property] !== undefined
  )
  if (keys.length === 1) {
    const missing = keys[0] === 'timestampKey' ? 'signatureKey' : 'timestampKey'
    return `Automation '${automationName}': '${keys[0]}' needs '${missing}' in the webhook auth`
  }
  if (keys.length === 2 && auth.timestampKey === auth.signatureKey) {
    return `Automation '${automationName}': 'timestampKey' and 'signatureKey' must name two different entries of the header`
  }
  if (keys.length === 0 && spelled !== undefined) {
    return `Automation '${automationName}': '${spelled}' applies only to a layout spelled out with 'timestampKey' and 'signatureKey'`
  }
  return keys.length === 2
    ? true
    : `Automation '${automationName}': the 'hmac-timestamp' signature scheme requires 'format' (or 'timestampKey' and 'signatureKey') in the webhook auth`
}

/**
 * `hmac-timestamp` reads the header the operator names in the layout its
 * `format` preset or its spelled-out keys name, so a header and exactly one
 * layout are required; its signature is always hex SHA-256, so `prefix` and
 * `algorithm` would be ignored and are refused. `tolerance` is accepted, as
 * for the named schemes.
 */
const hmacTimestampIssue = (automationName: string, auth: WebhookAuthLike): true | string => {
  if (auth.header === undefined) {
    return `Automation '${automationName}': the 'hmac-timestamp' signature scheme requires 'header' in the webhook auth`
  }
  const layout = layoutIssue(automationName, auth)
  if (layout !== true) return layout
  const fixed = FIXED_BY_HMAC_TIMESTAMP.find((property) => auth[property] !== undefined)
  return fixed === undefined
    ? true
    : `Automation '${automationName}': the 'hmac-timestamp' signature scheme is always hex SHA-256; remove '${fixed}' from the webhook auth`
}

/**
 * Check an incoming webhook's `hmac` auth for properties its `scheme` would
 * silently ignore or needs: `header`, `prefix` or `algorithm` beside a named
 * scheme (stripe, slack, svix); `header` or a layout missing from, a layout
 * named twice or by half in, or `prefix` / `algorithm` beside,
 * `hmac-timestamp`; a layout property beside any other scheme; `tolerance` beside `hex`/`base64`, which sign no timestamp. Returns a
 * message naming the automation and the property, or `true` when the
 * combination is coherent.
 */
export const validateWebhookSignatureScheme = (
  automationName: string,
  trigger: { readonly type: string; readonly auth?: WebhookAuthLike }
): true | string => {
  if (trigger.type !== 'webhook' || trigger.auth?.type !== 'hmac') return true
  const { auth } = trigger
  const scheme = auth.scheme ?? 'hex'
  if (scheme === 'hmac-timestamp') return hmacTimestampIssue(automationName, auth)
  const layoutProperty = LAYOUT_PROPERTIES.find((property) => auth[property] !== undefined)
  if (layoutProperty !== undefined) {
    return `Automation '${automationName}': '${layoutProperty}' applies only to the hmac-timestamp signature scheme, not to '${scheme}'`
  }
  if (TIMESTAMPED_SCHEMES.has(scheme)) {
    const fixed = FIXED_BY_SCHEME.find((property) => auth[property] !== undefined)
    return fixed === undefined
      ? true
      : `Automation '${automationName}': the '${scheme}' signature scheme fixes its own ${fixed}; remove '${fixed}' from the webhook auth`
  }
  return auth.tolerance === undefined
    ? true
    : `Automation '${automationName}': 'tolerance' applies only to the stripe, slack, svix and hmac-timestamp signature schemes, not to '${scheme}'`
}
