/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The hidden `_idempotency` field a form posts: the key a duplicate of this
 * render's submission is answered from instead of being stored again
 * (`presentation/api/runtime/idempotency.ts`). Never stored, never written to
 * the table, never passed to an automation.
 *
 * A form drawn on its own route is drawn per request, so the server mints its
 * key. A form placed on a page (`embedded`) is drawn EMPTY: a page may be
 * served from the page cache, and one key in a cached page would be every
 * visitor's — so the form's script mints it as the page loads, and again after
 * each success (`form-runtime-submit.ts`).
 */
export function IdempotencyKeyInput({ embedded }: { readonly embedded: boolean | undefined }) {
  return (
    <input
      type="hidden"
      name="_idempotency"
      value={embedded === true ? '' : crypto.randomUUID()}
      readOnly
    />
  )
}
