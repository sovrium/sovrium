/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The form's own interface strings (`form.*`: default submit labels, the
 * required-field message, the pending caption, the failure fallback), resolved
 * on the server against the page language and the author's translations, and
 * sent only where they differ from English. Absent on an English page, where
 * every string keeps its English literal. No catalog ships to the browser.
 */
export type FormStrings = Readonly<Record<string, string>>

/** One form interface string: the server-resolved text, or the English literal. */
export function formString(strings: FormStrings | undefined, key: string, english: string): string {
  return strings?.[key] ?? english
}
