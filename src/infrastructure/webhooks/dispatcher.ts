/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { validateOutboundUrl } from '@/infrastructure/utils/validate-outbound-url'
import { withFetchTimeout } from '@/infrastructure/utils/with-fetch-timeout'
import { generateSignature } from './signature'

interface DeliverWebhookOptions {
  readonly secret?: string
  readonly extraHeaders?: Record<string, string>
  readonly timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 30_000

export const deliverWebhook = async (
  url: string,
  event: string,
  payload: Record<string, unknown>,
  options?: DeliverWebhookOptions
): Promise<Record<string, unknown>> => {
  const secret = options?.secret
  const extraHeaders = options?.extraHeaders
  const validation = validateOutboundUrl(url)
  if (!validation.ok) {
    return {
      statusCode: 0,
      responseBody: '',
      duration: 0,
      success: false,
      error: `invalid_outbound_url_${validation.issue.reason}`,
    }
  }

  const body = JSON.stringify(payload)
  const signatureHeader: Record<string, string> = secret
    ? { 'X-Webhook-Signature': await generateSignature(body, secret) }
    : {}
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Sovrium-Webhook/1.0',
    'X-Webhook-Event': event,
    ...signatureHeader,
    ...(extraHeaders ?? {}),
  }

  const startTime = performance.now()

  const response = await withFetchTimeout(
    url,
    {
      method: 'POST',
      headers,
      body,
    },
    options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  )

  const duration = performance.now() - startTime
  const responseBody = await response.text()

  return {
    statusCode: response.status,
    responseBody,
    duration,
    success: response.status >= 200 && response.status < 300,
    requestHeaders: headers,
  }
}
