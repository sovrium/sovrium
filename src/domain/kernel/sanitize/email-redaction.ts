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

/** The characters an unquoted mailbox may hold (RFC 5322 `atext` and the dot, plus letters beyond ASCII). */
const MAILBOX_CHAR = "\\p{L}\\p{N}.!#$%&'*+/=?^_`{|}~-"

/**
 * An address inside free text: a mailbox, `@`, then one or more dot-separated
 * labels. The look-behind starts a match only at the beginning of a mailbox, so
 * a long run of mailbox characters with no `@` in it is scanned once rather than
 * once per starting position. A single-label domain (`rcpt@localhost`) is still
 * an address: masking one that was not is the safe direction.
 */
const ADDRESS_IN_TEXT = new RegExp(
  `(?<![${MAILBOX_CHAR}])[${MAILBOX_CHAR}]+@[\\p{L}\\p{N}-]+(?:\\.[\\p{L}\\p{N}-]+)*`,
  'gu'
)

/**
 * Free text with every email address in it reduced to {@link redactEmail}'s
 * masked form, and everything else left as it was.
 *
 * For a message somebody else wrote that is about to be logged: a mail
 * transport's failure names the recipient it refused
 * (`550 5.1.1 <ada@example.com>: Recipient address rejected`), and a log reader
 * and every log sink have no business with that address. The status codes and
 * the transport's own words survive, so the line still says what went wrong
 * (`550 5.1.1 <a•••@example.com>: Recipient address rejected`).
 */
export const redactEmailAddresses = (text: string): string =>
  text.replace(ADDRESS_IN_TEXT, (address) => redactEmail(address))
