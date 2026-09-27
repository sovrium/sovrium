/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * An email address reduced to what tells two accounts apart without handing
 * the address itself to whoever reads it: its first character and its domain
 * (`ada@example.com` → `a•••@example.com`). Anything that is not an address
 * reduces to the mask alone, never to itself.
 *
 * For a list that shows an account to a reader who has no business with its
 * address — the account directory a `user` picker offers every signed-in
 * visitor, where a nameless account would otherwise be labelled by its email.
 */
export const redactEmail = (email: string): string => {
  const at = email.lastIndexOf('@')
  if (at <= 0 || at === email.length - 1) return '•••'
  return `${email.slice(0, 1)}•••${email.slice(at)}`
}
