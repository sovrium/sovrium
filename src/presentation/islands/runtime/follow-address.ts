/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Follow a navigation address a config action produced — the ONE place an
 * island hands a substituted address to the browser.
 *
 * Every such address is built from config plus row data (`$record.<field>`),
 * and row data is whatever was imported, so it is a URL-valued sink fed by
 * visitor-influenced text. It therefore goes through {@link toSafeAssetUrl}
 * first: a same-origin absolute path or an `http(s)` URL is followed, anything
 * else (`javascript:`, `data:`, a relative path, the empty string) is not
 * followed at all — the caller reports the refusal, the browser never sees it.
 *
 * A new tab is opened with `noopener,noreferrer`, so the destination gets no
 * `window.opener` handle on the page that opened it and no `Referer` header.
 */

import { toSafeAssetUrl } from '@/domain/kernel/url/asset-url-safety'

/** How the address is followed: the current tab, or a new one. */
export interface FollowAddressOptions {
  readonly openInNewTab?: boolean
}

/**
 * Follow `address` when it is a safe web address. Returns `true` when the
 * browser was sent somewhere, `false` when the address was refused (or there
 * is no browser to send).
 */
export function followAddress(address: string, options: FollowAddressOptions = {}): boolean {
  const safe = toSafeAssetUrl(address)
  if (safe === undefined || typeof window === 'undefined') return false
  if (options.openInNewTab === true) window.open(safe, '_blank', 'noopener,noreferrer')
  else window.location.assign(safe)
  return true
}
