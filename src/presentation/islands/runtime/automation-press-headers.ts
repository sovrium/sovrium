/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The headers of one press of a page's automation — a button, a row action, a
 * menu item, a dialog confirm or an automation form posting to
 * `/api/automations/:name/form-action`: a JSON body, and a fresh
 * `Idempotency-Key`, so a duplicate of THIS press is answered from the first
 * one instead of starting the run again (`api/runtime/idempotency.ts`). A new
 * press is a new key.
 *
 * `getRandomValues` rather than `randomUUID`: the latter exists only in a
 * secure context, and a self-hosted app may be reached over plain HTTP.
 */
export function automationPressHeaders(): Record<string, string> {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return { 'Content-Type': 'application/json', 'Idempotency-Key': key }
}
