/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where an answered action goes when its `navigate` reads the address its run
 * returned — the one case an action may leave the site, on the exact origins
 * its `onSuccess.allowOrigins` lists.
 *
 * Kept apart from `action-outcome.ts` on purpose: only the surfaces that read a
 * run's answer (the automation button, the fetch action, the endpoint form)
 * load it, so every other control that runs a success pays nothing for it.
 */

import { toSafeAssetUrl } from '@/domain/kernel/url/asset-url-safety'
import { toAllowedOriginAddress } from '@/domain/kernel/url/redirect-safety'
import { leavesPage, onThisSite } from './action-outcome'

/**
 * A `navigate` that is exactly one `$response.<path>` reference: the address the
 * run returned. The same shape the config decode admits beside `allowOrigins`
 * (`domain/models/app/pages/components/action-allow-origins.ts`), restated here
 * so the always-loaded runtime does not pull the schema module in.
 */
const LONE_RESPONSE_REFERENCE = /^\$response(?:\.[A-Za-z_][A-Za-z0-9_]*)+$/

/** How long a success waits before it leaves, as an in-app `navigate` does. */
const LEAVE_DELAY_MS = 500

/** Where a success goes: on this site, to a listed origin, or nowhere because it was refused. */
export type SuccessExit =
  { readonly navigate?: string | undefined; readonly away?: string | undefined } | 'refused'

/**
 * Judge where a success goes. A `navigate` the author wrote is followed as
 * before, on this site only. One that is a lone `$response.<path>` — an address
 * the run returned — is followed when it is on this site, or on an origin
 * `allowOrigins` lists exactly (the kernel's `toAllowedOriginAddress`); any
 * other answer is `'refused'`, and the caller shows `onError` instead.
 */
export function judgeSuccessExit(
  declared: string | undefined,
  resolved: string | undefined,
  allowOrigins: readonly string[] | undefined
): SuccessExit {
  if (declared === undefined || !LONE_RESPONSE_REFERENCE.test(declared)) {
    return { navigate: resolved }
  }
  if (onThisSite(resolved) !== undefined) return { navigate: resolved }
  const away = toAllowedOriginAddress(resolved, allowOrigins)
  return away === undefined ? 'refused' : { away }
}

/** True when a judged exit leaves the page: to another document here, or another site. */
export function exitLeavesPage(exit: SuccessExit): boolean {
  return exit !== 'refused' && (exit.away !== undefined || leavesPage(exit.navigate))
}

/**
 * The outcome fields of a judged exit: the in-app `navigate`, or a `leave` that
 * sends the whole page to the listed origin after the same short wait, through
 * the canonical web-address check at the sink.
 */
export function exitOutcome(exit: Exclude<SuccessExit, 'refused'>): {
  readonly navigate?: string | undefined
  readonly leave?: () => void
} {
  const away = toSafeAssetUrl(exit.away)
  if (away === undefined) return { navigate: exit.navigate }
  return { leave: () => setTimeout(() => window.location.assign(away), LEAVE_DELAY_MS) }
}
