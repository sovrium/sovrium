/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where a successful sign-in, sign-up or account form moves the reader on, and
 * the toast that goes with them — the rules every page action follows, read
 * from the kernel (`domain/kernel/url/redirect-resolution.ts`) as the shared
 * outcome runtime reads them, rather than importing that runtime, which would
 * add its whole module to this island's mount cost.
 *
 * - A relative address (`welcome`, `?signed-in=1`) is resolved against the
 *   page, and the result is a path on this site or nothing.
 * - When the move leaves the page, the success toast is carried to the page
 *   the reader lands on (`design/carried-toast.ts`).
 */

import { isAnotherDocument, resolveRedirectAgainst } from '@/domain/kernel/url/redirect-resolution'
import { carryToast } from '@/presentation/design/carried-toast'

/**
 * The path `address` moves the reader to, resolved against this page — and,
 * when it leaves the page, the success toast kept for the page they land on.
 */
export function successMoveAddress(
  address: string | undefined,
  toast: { readonly message?: string; readonly variant?: string } | undefined
): string | undefined {
  const { href, origin } = globalThis.location
  const target = resolveRedirectAgainst(address, href, origin)
  if (target !== undefined && toast?.message && isAnotherDocument(target, href)) {
    carryToast({ message: toast.message, variant: toast.variant })
  }
  return target
}
