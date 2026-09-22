/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Saving a `Blob` to disk under a chosen name.
 *
 * Two islands need this and they arrive from opposite directions: the action
 * executor FETCHES a file and then has to name it, while a grid bound to a
 * system read endpoint BUILDS its selection CSV in the browser and never issues
 * a request at all. Both end at the same three steps, so they share them — a
 * second copy is how one of the two quietly loses the deferred cleanup below
 * and starts leaking object URLs.
 *
 * It lives in `runtime/` rather than beside either caller because that is the
 * lowest island tier: `parts` and `hooks` may reach down into it, and a helper
 * placed in either of those would be an up-edge for the other.
 */

/**
 * Save `blob` as a `download`-attributed anchor click named `filename`.
 *
 * A no-op without a document, so a server-side render can call through without
 * guarding at every call site.
 */
export function saveBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return
  const objectUrl = URL.createObjectURL(blob)
  // `setAttribute` (a method call) configures the transient anchor without
  // tripping `functional/immutable-data`'s ban on property-assignment mutation.
  const anchor = document.createElement('a')
  anchor.setAttribute('href', objectUrl)
  anchor.setAttribute('download', filename)
  anchor.setAttribute('style', 'display:none')
  document.body.append(anchor)
  anchor.click()
  // Defer cleanup so the download task is dispatched before the object URL is
  // revoked and the anchor removed (the FileSaver-style deferred-cleanup pattern).
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
    anchor.remove()
  }, 0)
}
