/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { validateOutboundUrl } from '@/infrastructure/egress/validate-outbound-url'
import { withFetchTimeout } from '@/infrastructure/egress/with-fetch-timeout'
import { generateSignature } from './signature'

/**
 * Optional delivery configuration for {@link deliverWebhook}.
 *
 * - `secret`: when set, an HMAC-SHA256 signature of the body is added under
 *   the fixed `X-Webhook-Signature` header (legacy automation-webhook path).
 * - `extraHeaders`: caller-built authentication headers (HMAC with a custom
 *   header/algorithm, API key, or bearer token) merged onto the request.
 */
interface DeliverWebhookOptions {
  readonly secret?: string
  readonly extraHeaders?: Record<string, string>
  /**
   * Hard timeout in milliseconds for the HTTP request. Defaults to 30s.
   * Table-webhook delivery passes a shorter value so an unreachable upstream
   * fails fast enough for the retry policy to run within request time.
   */
  readonly timeoutMs?: number
}

/** Default hard timeout for a webhook HTTP request, in milliseconds. */
const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Deliver a webhook via HTTP POST.
 *
 * The full header set actually sent is echoed back under `requestHeaders` so
 * callers can persist it (e.g. to a delivery-log row).
 * @public
 */
export const deliverWebhook = async (
  url: string,
  event: string,
  payload: Readonly<Record<string, unknown>>,
  options?: DeliverWebhookOptions
): Promise<Record<string, unknown>> => {
  const secret = options?.secret
  const extraHeaders = options?.extraHeaders
  // SSRF guard: reject loopback / link-local / RFC1918 / unsupported
  // protocols BEFORE making the request. Returns a failure envelope shaped
  // like a fetch error so existing callers handle it through their
  // success-flag branch without an extra throw path.
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
  const signatureHeader: Readonly<Record<string, string>> = secret
    ? { 'X-Webhook-Signature': await generateSignature(body, secret) }
    : {}
  const headers: Readonly<Record<string, string>> = {
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
