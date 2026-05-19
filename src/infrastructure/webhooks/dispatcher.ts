/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { validateOutboundUrl } from '@/infrastructure/utils/validate-outbound-url'
import { withFetchTimeout } from '@/infrastructure/utils/with-fetch-timeout'
import { generateSignature } from './signature'

export const deliverWebhook = async (
  url: string,
  event: string,
  payload: Record<string, unknown>,
  secret?: string
): Promise<Record<string, unknown>> => {
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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Sovrium-Webhook/1.0',
    'X-Webhook-Event': event,
  }

  if (secret) {
    const sig = await generateSignature(body, secret)
    headers['X-Webhook-Signature'] = sig
  }

  const startTime = performance.now()

  const response = await withFetchTimeout(
    url,
    {
      method: 'POST',
      headers,
      body,
    },
    30_000
  )

  const duration = performance.now() - startTime
  const responseBody = await response.text()

  return {
    statusCode: response.status,
    responseBody,
    duration,
    success: response.status >= 200 && response.status < 300,
  }
}
