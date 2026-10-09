/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The request headers a webhook's own `auth` designates as its credential.
 *
 * The authentication check reads the key or the signature from these headers;
 * a run keeps the request it started from, and these are the headers whose
 * value it must not keep. Both read the defaults from here, so the header the
 * check reads and the header the run hides cannot drift apart.
 *
 * `bearer` and `basic` read `Authorization`, and a named hmac scheme (`stripe`,
 * `slack`, `svix`) fixes a header whose name already says `signature`: the
 * general header rule covers those, so they are not listed here.
 */

import { redactTriggerDataHeaders } from '@/domain/kernel/sanitize/http-header-redaction'
import { triggersOfType } from '../trigger-entries-service'
import type { Trigger } from './trigger'
import type { WebhookTrigger } from './webhook'

/** The header an `apiKey` webhook reads its key from when `auth.header` is omitted. */
export const DEFAULT_WEBHOOK_API_KEY_HEADER = 'X-API-Key'

/** The header a `hex` / `base64` hmac webhook reads its digest from when `auth.header` is omitted. */
export const DEFAULT_WEBHOOK_SIGNATURE_HEADER = 'X-Signature'

/** The header names a webhook trigger's `auth` reads a credential from, beyond the standard ones. */
export const webhookCredentialHeaderNames = (
  trigger: Pick<WebhookTrigger, 'auth'>
): readonly string[] => {
  const { auth } = trigger
  if (auth?.type === 'apiKey') return [auth.header ?? DEFAULT_WEBHOOK_API_KEY_HEADER]
  if (auth?.type === 'hmac') return [auth.header ?? DEFAULT_WEBHOOK_SIGNATURE_HEADER]
  return []
}

/**
 * The credential header names of every webhook entry of an automation — what a
 * read of a recorded run hides when it cannot tell which entry started it.
 * Hiding a header that entry never read costs nothing; showing one it did
 * would.
 */
export const automationWebhookCredentialHeaderNames = (
  automation: { readonly triggers: ReadonlyArray<Trigger> } | undefined
): readonly string[] =>
  automation === undefined
    ? []
    : triggersOfType(automation, 'webhook').flatMap(webhookCredentialHeaderNames)

/**
 * A recorded run's `triggerData` with its credential headers hidden, as every
 * read and replay of the run takes it: a run recorded since the marker was
 * kept already carries it, and one recorded before is hidden here.
 */
export const redactRunTriggerData = (
  triggerData: unknown,
  automation: { readonly triggers: ReadonlyArray<Trigger> } | undefined
): unknown =>
  redactTriggerDataHeaders(triggerData, automationWebhookCredentialHeaderNames(automation))
