/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the console's SPA navigation does when a swap cannot happen for a reason
 * the reader can act on, instead of falling back to a full navigation that
 * would only show them the browser's error page or a bare "Page not found":
 *
 *  - OFFLINE: the shell stays, and the content region says so, with a Retry —
 *    and the navigation is tried again on its own when the browser is back.
 *  - SESSION ENDED: the console leaves for its own sign-in page, carrying where
 *    the reader was going (`?next=`), so signing in brings them back there.
 *
 * Both apply to the console's own mount only. An app's pages keep the plain
 * fallback, and an anonymous deep link keeps its canonical 404: these paths run
 * only in a document that was served to a signed-in operator.
 */

import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { resolveMountBasePath } from '@/presentation/islands/runtime/mount-base-path'

/** The hidden, server-rendered offline notice the shell carries in the page's language. */
const OFFLINE_TEMPLATE_SELECTOR = '[data-spa-offline-template]'

/** The notice once it is placed in the content region. */
const OFFLINE_NOTICE_SELECTOR = '[data-spa-offline]'

/** The notice's Retry control. */
const RETRY_SELECTOR = '[data-spa-retry]'

/**
 * Leave for the console's sign-in page, carrying `next` — the console path the
 * reader was on or going to. The address is built here and checked by the
 * canonical redirect rule, never taken from the page.
 */
export function leaveForSignIn(next: string): void {
  const signIn = `${resolveMountBasePath()}/login?next=${encodeURIComponent(next)}`
  const target = toSafeRedirectPath(signIn)
  if (target !== undefined) window.location.assign(target)
}

/**
 * Whether the reader's session has ended — asked of the auth API, which
 * answers `null` for a browser holding no live session. A refused partial is
 * not proof on its own: a page that genuinely does not exist answers 404 too.
 */
export async function sessionHasEnded(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/get-session', { credentials: 'include' })
    if (!response.ok) return false
    const body = (await response.json().catch(() => undefined)) as
      { readonly session?: unknown } | null | undefined
    return body === null || (body !== undefined && !body.session)
  } catch {
    return false
  }
}

/**
 * Show the offline notice at the top of the content region, below its header,
 * and wire its Retry. Returns `false` when the page carries no notice to show
 * (an app page), so the caller keeps its ordinary fallback.
 */
export function showOfflineNotice(regionId: string, onRetry: () => void): boolean {
  const region = document.getElementById(regionId)
  const template = document.querySelector(OFFLINE_TEMPLATE_SELECTOR)?.firstElementChild
  if (!region || !(template instanceof HTMLElement)) return false
  region.querySelector(OFFLINE_NOTICE_SELECTOR)?.remove()
  const notice = template.cloneNode(true) as HTMLElement
  notice.setAttribute('data-spa-offline', 'true')
  notice.querySelector(RETRY_SELECTOR)?.addEventListener('click', onRetry)
  const header = region.querySelector(':scope > header')
  if (header) header.after(notice)
  else region.prepend(notice)
  return true
}
