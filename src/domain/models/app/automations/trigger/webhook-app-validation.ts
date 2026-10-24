/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { validateEmailSuppressTriggers } from './email-suppress-trigger-validation'
import { validateRevealWriteOnly, validateWebhookRunAs } from './webhook-reveal-validation'
import { validateSessionWebhookAuth } from './webhook-session-validation'
import { validateTelemetryProjectReferences } from './webhook-telemetry-validation'

type WebhookAppLike = Parameters<typeof validateSessionWebhookAuth>[0] &
  Parameters<typeof validateRevealWriteOnly>[0] &
  Parameters<typeof validateTelemetryProjectReferences>[0] &
  Parameters<typeof validateEmailSuppressTriggers>[0]

/**
 * The webhook-trigger rules that need the whole app — its `auth` block, its
 * tables and their fields — in the order they are reported: a session webhook
 * needs auth, `revealWriteOnly` and `runAs: 'system'` need a machine caller (the
 * former write-only fields too), a `projectKey` needs its table, and an
 * `email/suppress` step needs a signed or admin-only caller. Returns the
 * first message, or `true`.
 */
export const validateWebhookTriggersAgainstApp = (app: WebhookAppLike): true | string => {
  const sessionVerdict = validateSessionWebhookAuth(app)
  if (sessionVerdict !== true) return sessionVerdict
  const revealVerdict = validateRevealWriteOnly(app)
  if (revealVerdict !== true) return revealVerdict
  const runAsVerdict = validateWebhookRunAs(app)
  if (runAsVerdict !== true) return runAsVerdict
  const telemetryVerdict = validateTelemetryProjectReferences(app)
  return telemetryVerdict === true ? validateEmailSuppressTriggers(app) : telemetryVerdict
}
