/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The one-time codes a signer answers before she signs, as pure rules.
 *
 * A code is six digits, valid ten minutes, and stored only as an HMAC keyed by
 * the deployment's code secret over the request, the signer, the challenge and
 * the code, so a stored value proves nothing outside its own challenge. A new
 * code waits sixty seconds after the last one; a signer receives at most three
 * codes for one request, and one network address at most ten an hour across
 * every request. Every code checked counts toward a signer's five tries per
 * request and channel, counted across every code she received: the fifth
 * wrong one locks her verification for the life of the request. Twenty links
 * that lead nowhere from one address close the link road to it for an hour.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { escapeHtmlAttribute } from '@/domain/kernel/sanitize/html-escaping'

/** How long a code is accepted. */
export const SIGNATURE_CODE_VALIDITY_MS = 10 * 60_000

/** How long a signer waits between two codes. */
export const SIGNATURE_CODE_RESEND_COOLDOWN_MS = 60_000

/** How many codes one signer receives for one request. */
export const MAX_SIGNATURE_CODES_PER_SIGNER = 3

/** How many codes one network address receives in an hour, across every request. */
export const MAX_SIGNATURE_CODES_PER_ADDRESS = 10

/** How many codes a signer may try per request and channel before her verification locks. */
export const MAX_SIGNATURE_CODE_ATTEMPTS = 5

/** How many links that lead nowhere one address may open in an hour before the road closes to it. */
export const MAX_INVALID_SIGNING_LINKS_PER_ADDRESS = 20

/** The window both per-address budgets count over. */
export const SIGNATURE_ADDRESS_WINDOW_MS = 60 * 60_000

/** The shape a code has: six digits. */
const CODE_PATTERN = /^\d{6}$/

/** Whether `code` has the shape of a code. */
export const isSignatureCodeShaped = (code: string): boolean => CODE_PATTERN.test(code)

/** What a code's HMAC binds: the request, the signer, the challenge and the code. */
export interface SignatureCodeBinding {
  readonly requestId: string
  readonly signerId: string
  readonly challengeId: string
  readonly code: string
}

/** The HMAC-SHA256 (hex) stored for a code, keyed by the deployment's code secret. */
export const signatureCodeHmac = (secret: string, binding: SignatureCodeBinding): string =>
  createHmac('sha256', secret)
    .update(`${binding.requestId}|${binding.signerId}|${binding.challengeId}|${binding.code}`)
    .digest('hex')

/** Whether `code` is the one `storedHmac` was computed for, compared in constant time. */
export const signatureCodeMatches = (
  secret: string,
  binding: SignatureCodeBinding,
  storedHmac: string
): boolean => {
  const computed = Buffer.from(signatureCodeHmac(secret, binding), 'utf8')
  const stored = Buffer.from(storedHmac, 'utf8')
  return computed.length === stored.length && timingSafeEqual(computed, stored)
}

/** How many codes there are: every six-digit string, `000000` to `999999`. */
export const SIGNATURE_CODE_SPACE = 1_000_000

/**
 * The six-digit code for `value`, zero-padded, or `undefined` when `value` is
 * not an integer in `[0, SIGNATURE_CODE_SPACE)`. The value must already be
 * drawn uniformly over that range: this only formats it, and never folds a
 * wider draw into it, since folding is what makes some codes likelier.
 */
export const signatureCodeOf = (value: number): string | undefined =>
  Number.isInteger(value) && value >= 0 && value < SIGNATURE_CODE_SPACE
    ? String(value).padStart(6, '0')
    : undefined

/**
 * An address as a code's answer shows it: the first character of the local
 * part, the rest masked, the domain kept (`a•••@example.com`).
 */
export const maskedEmailAddress = (address: string): string => {
  const at = address.lastIndexOf('@')
  if (at <= 0) return '•••'
  return `${address.slice(0, 1)}•••${address.slice(at)}`
}

/** Where a signer stands with her codes for one request and channel. */
export interface SignerCodeStanding {
  /** Codes she received. */
  readonly issued: number
  /** When she received the last one, in epoch milliseconds. */
  readonly lastIssuedAtMs?: number | undefined
  /** Codes she tried, across every code she received. */
  readonly attempts: number
}

/** Why a new code is refused. */
export type CodeIssueRefusal = 'TOO_MANY_CODE_ATTEMPTS' | 'RESEND_TOO_SOON' | 'TOO_MANY_CODES_SENT'

/**
 * Why a signer may not receive a new code now, or `undefined`: a locked
 * verification first (nothing else would help her), then the cooldown, then
 * the signer's and the address's budgets.
 */
export const codeIssueRefusal = (input: {
  readonly standing: SignerCodeStanding
  readonly sentFromAddress: number
  readonly nowMs: number
}): CodeIssueRefusal | undefined => {
  const { standing, sentFromAddress, nowMs } = input
  if (standing.attempts >= MAX_SIGNATURE_CODE_ATTEMPTS) return 'TOO_MANY_CODE_ATTEMPTS'
  if (
    standing.lastIssuedAtMs !== undefined &&
    nowMs < standing.lastIssuedAtMs + SIGNATURE_CODE_RESEND_COOLDOWN_MS
  ) {
    return 'RESEND_TOO_SOON'
  }
  if (standing.issued >= MAX_SIGNATURE_CODES_PER_SIGNER) return 'TOO_MANY_CODES_SENT'
  return sentFromAddress >= MAX_SIGNATURE_CODES_PER_ADDRESS ? 'TOO_MANY_CODES_SENT' : undefined
}

/** A stored challenge, as a check reads it. */
export interface StoredChallengeState {
  readonly signerId: string
  readonly expiresAtMs: number
  readonly consumed: boolean
  readonly documentHash?: string | undefined
}

/**
 * What a challenge answers before its code is compared: refused as invalid
 * (another signer's, already used, bound to another document), as expired, or
 * open to a try.
 */
export const challengeOpenToTry = (input: {
  readonly challenge: StoredChallengeState | undefined
  readonly signerId: string
  readonly documentHash: string
  readonly nowMs: number
}): 'CODE_INVALID' | 'CODE_EXPIRED' | 'open' => {
  const { challenge } = input
  if (
    challenge === undefined ||
    challenge.signerId !== input.signerId ||
    challenge.consumed ||
    challenge.documentHash !== input.documentHash
  ) {
    return 'CODE_INVALID'
  }
  return input.nowMs >= challenge.expiresAtMs ? 'CODE_EXPIRED' : 'open'
}

/**
 * How a try ends, given the signer's tries counted with this one: past the
 * limit she is locked whatever she typed; a wrong code that reaches the limit
 * locks her; else a wrong code is invalid and a right one verifies.
 */
export const tryOutcome = (input: {
  readonly attemptsWithThisOne: number
  readonly matches: boolean
}): 'verified' | 'CODE_INVALID' | 'TOO_MANY_CODE_ATTEMPTS' => {
  if (input.attemptsWithThisOne > MAX_SIGNATURE_CODE_ATTEMPTS) return 'TOO_MANY_CODE_ATTEMPTS'
  if (input.matches) return 'verified'
  return input.attemptsWithThisOne >= MAX_SIGNATURE_CODE_ATTEMPTS
    ? 'TOO_MANY_CODE_ATTEMPTS'
    : 'CODE_INVALID'
}

/** The mail carrying a code: the code in the body only, never in the subject. */
export const signatureCodeMail = (input: {
  readonly appName: string
  readonly displayName: string
  readonly code: string
}): { readonly subject: string; readonly text: string; readonly html: string } => {
  const greeting = input.displayName === '' ? 'Hello,' : `Hello ${input.displayName},`
  const minutes = SIGNATURE_CODE_VALIDITY_MS / 60_000
  const body = `Your code to sign the document is ${input.code}. It is valid ${String(minutes)} minutes.`
  const notYou = 'If you did not ask for it, ignore this message: nothing is signed without it.'
  return {
    subject: `${input.appName}: your signing code`,
    text: `${greeting}\n\n${body}\n\n${notYou}`,
    html: `<p>${escapeHtmlAttribute(greeting)}</p><p>${escapeHtmlAttribute(body)}</p><p>${notYou}</p>`,
  }
}

/**
 * A phone as a signer is shown it: the country prefix and the last two
 * digits, the rest hidden (`+33 •• •• •• •• 42`).
 */
export const maskedPhoneNumber = (phone: string): string => {
  const digits = phone.replaceAll(/\D/g, '')
  if (digits.length < 6) return '•••'
  const prefix = phone.startsWith('+') ? `+${digits.slice(0, 2)} ` : ''
  return `${prefix}•• •• •• •• ${digits.slice(-2)}`
}

/**
 * The text message a code travels in: the app's name, the code and how long
 * it is valid, and nothing that identifies the document or the signer.
 */
export const signatureCodeText = (input: {
  readonly appName: string
  readonly code: string
}): string => {
  const minutes = SIGNATURE_CODE_VALIDITY_MS / 60_000
  return `${input.appName}: your signing code is ${input.code}. It is valid ${String(minutes)} minutes. Never share it.`
}
