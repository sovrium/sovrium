/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Canonical, ReDoS-safe email-format validation.
 *
 * Replaces five verbatim copies of `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` that were
 * scattered across the auth, forms, env-config, and client-island layers. One
 * of those copies (`bootstrap-admin.ts`, reachable from `process.env`) was
 * flagged by CodeQL as `js/polynomial-redos` (alert #27): the trailing
 * `\.[^\s@]+` overlaps the preceding `[^\s@]+` (a literal `.` is itself matched
 * by `[^\s@]`), so on a non-matching input such as `'!@!.' + '!.'.repeat(n)`
 * the backtracking engine explores quadratically many split points.
 *
 * This module is pure (no `process.env`, no Node APIs) so it is safe to import
 * from client-bundle islands per eco rule R2 / security rule S4.
 */

/**
 * RFC 5322-lite email pattern — `local@domain.tld`. Exported as a shared
 * constant for `Schema.pattern(...)` (server env validation) and client-side
 * form validation. The ReDoS ambiguity in this pattern is neutralised at the
 * call boundary by the length cap in {@link isValidEmail} — never run
 * `EMAIL_PATTERN.test()` directly on unbounded, untrusted input.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * RFC 5321 maximum total email length. Inputs longer than this cannot be valid
 * addresses, and capping length here bounds the worst-case matching time of
 * {@link EMAIL_PATTERN} to linear — the mitigation `js/polynomial-redos`
 * explicitly recommends when a clean non-backtracking rewrite is awkward.
 */
export const MAX_EMAIL_LENGTH = 254

/**
 * Returns `true` when `email` is a well-formed `local@domain.tld` address.
 *
 * MUST bound the input length (see {@link MAX_EMAIL_LENGTH}) BEFORE running the
 * regex, so a maliciously long string can never trigger the polynomial-time
 * backtracking path. This is the one security-critical decision in the module.
 */
export function isValidEmail(email: string): boolean {
  // Length guard FIRST — `&&` short-circuits so EMAIL_PATTERN.test() never runs
  // on an over-length string, bounding worst-case matching time to linear.
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email)
}

/**
 * The characters that separate, quote or group addresses in an address
 * header. A value holding one of them outside the angle brackets of a single
 * `Name <address>` could name a second recipient once a mail transport parses
 * it.
 */
const ADDRESS_LIST_SYNTAX = /[,;<>"()[\]\\:]/

/** `Display Name <address>`, the display name free of address-list syntax and of `@`. */
const NAMED_MAILBOX = /^([^<>,;"()[\]\\:@]*)<([^<>]*)>$/

/**
 * Returns `true` when `value` names exactly ONE mailbox: a bare
 * `local@domain.tld`, or `Display Name <local@domain.tld>` whose name holds no
 * separator, quote or bracket. A list (`a@x.fr, b@y.fr`, `a@x.fr; b@y.fr`), a
 * second bracketed address or a quoted display name is refused.
 *
 * For a value an automation took from data it did not write (a form, a
 * webhook body, a record): one value, one recipient.
 */
export function isSingleMailbox(value: string): boolean {
  // Bounded before either pattern runs, as `isValidEmail` is.
  if (value.length > MAX_EMAIL_LENGTH * 2) return false
  const trimmed = value.trim()
  const named = NAMED_MAILBOX.exec(trimmed)
  const address = named === null ? trimmed : (named[2] ?? '').trim()
  return !ADDRESS_LIST_SYNTAX.test(address) && isValidEmail(address)
}
