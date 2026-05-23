/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHmac } from 'node:crypto'
import { Effect } from 'effect'
import { HTTP_REQUEST_TIMEOUT_MS } from '@/domain/utils/timeouts'
import { validateOutboundUrl } from '@/infrastructure/utils/validate-outbound-url'
import { withFetchTimeout } from '@/infrastructure/utils/with-fetch-timeout'
import { resolveConnectionHeaders } from './auth-headers'
import { serializeActionBody, stringProp } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'

export const handleWebhookSend: ActionHandler = (action, app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const url = stringProp(props, 'url')
    if (!url) return { status: 'failure', error: 'webhook.send requires a url' } as const

    const method = String(props['method'] ?? 'POST')
    const baseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((props['headers'] as Record<string, string> | undefined) ?? {}),
    }
    const connectionName = stringProp(props, 'connection')

    const merged =
      connectionName !== ''
        ? yield* resolveConnectionHeaders(app, automation, baseHeaders, connectionName)
        : { headers: baseHeaders }

    if (merged.error !== undefined) {
      return { status: 'failure', error: merged.error } as const
    }

    const rawBody = props['body'] === null ? undefined : props['body']
    const bodyResult = yield* Effect.either(serializeActionBody(rawBody))
    if (bodyResult._tag === 'Left') {
      return { status: 'failure', error: bodyResult.left.message } as const
    }

    const secret = stringProp(props, 'secret')
    const signedHeaders =
      secret !== ''
        ? { ...merged.headers, 'X-Webhook-Signature': signBody(bodyResult.right, secret) }
        : merged.headers

    return yield* Effect.promise(() => sendWebhook(url, method, signedHeaders, bodyResult.right))
  })

const signBody = (body: string | undefined, secret: string): string =>
  `sha256=${createHmac('sha256', secret)
    .update(body ?? '')
    .digest('hex')}`

export const handleWebhookResponse: ActionHandler = (action) =>
  Effect.sync(() => {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const responseOverride: Record<string, unknown> = {
      ...(props['status'] !== undefined ? { status: props['status'] } : {}),
      ...(props['body'] !== undefined ? { body: props['body'] } : {}),
      ...(props['headers'] !== undefined ? { headers: props['headers'] } : {}),
    }
    return { status: 'success', responseOverride } satisfies ActionOutcome
  })

const sendWebhook = async (
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined
): Promise<ActionOutcome> => {
  const validation = validateOutboundUrl(url)
  if (!validation.ok) {
    return { status: 'failure', error: `invalid_outbound_url_${validation.issue.reason}` }
  }

  try {
    const response = await withFetchTimeout(
      url,
      {
        method,
        headers,
        ...(body !== undefined ? { body } : {}),
      },
      HTTP_REQUEST_TIMEOUT_MS
    )
    if (!response.ok) {
      return {
        status: 'failure',
        error: `webhook ${url}: HTTP ${String(response.status)}`,
      }
    }
    return { status: 'success' }
  } catch (error) {
    return {
      status: 'failure',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
