/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The page APIs that reach the network outside the request interception
 *, taken away before any page script runs.
 *
 * WebRTC opens its own sockets — a TURN relay over TCP or TLS to any host the
 * page names — and WebTransport speaks HTTP/3 over UDP: neither is a request
 * `Fetch` pauses, `allowedHosts` never sees them, and the document policy
 * cannot name them (Chrome has no CSP directive and no switch for either,
 * measured). So every global they hang from — `RTC*`, `webkitRTC*`,
 * `WebTransport*` — is replaced by a non-configurable, non-writable
 * `undefined` in every realm, before the page's first script.
 *
 * Sent to Chrome as its own source (`Page.addScriptToEvaluateOnNewDocument`),
 * so it references nothing outside its body.
 */

/** Take the out-of-band network APIs away from this realm. Self-contained. */
export function lockDownNetworkApis(): void {
  // globalThis typed as the record it is: a page's global object, read by name.
  const scope: Record<string, unknown> = globalThis as typeof globalThis & Record<string, unknown>
  for (const name of Object.getOwnPropertyNames(scope)) {
    if (!/^(webkit)?RTC|^WebTransport/.test(name)) continue
    try {
      Object.defineProperty(scope, name, {
        value: undefined,
        writable: false,
        enumerable: false,
        configurable: false,
      })
    } catch {
      // Already locked in this realm.
    }
  }
}

/** The source Chrome evaluates in every new document of a guarded session. */
export const networkLockdownSource = `(${String(lockDownNetworkApis)})()`
