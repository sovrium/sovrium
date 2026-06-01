/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */



export interface RateLimitPolicy {
  readonly perIp: number
  readonly perForm: number
  readonly windowSeconds: number
}

export type RateLimitReason = 'rate_limit_per_ip' | 'rate_limit_per_form'

export type RateLimitResult =
  | { readonly ok: true }
  | {
      readonly ok: false
      readonly reason: RateLimitReason
      readonly retryAfterSec: number
    }


const perIpState = new Map<string, ReadonlyArray<number>>()

const perFormState = new Map<string, ReadonlyArray<number>>()

const composePerIpKey = (ipHash: string, formName: string): string => `${formName}:${ipHash}`

export const resetFormRateLimitState = (): void => {
  perIpState.clear()
  perFormState.clear()
}


const pruneTimestamps = (
  timestamps: ReadonlyArray<number>,
  windowMs: number,
  now: number
): ReadonlyArray<number> => timestamps.filter((t) => now - t < windowMs)

const computeRetryAfter = (oldest: number, windowMs: number, now: number): number => {
  const resetAtMs = oldest + windowMs
  return Math.max(1, Math.ceil((resetAtMs - now) / 1000))
}


interface CheckAndRecordInput {
  readonly ipHash: string
  readonly formName: string
  readonly policy: RateLimitPolicy
  readonly now?: number
}

export const checkAndRecord = (input: Readonly<CheckAndRecordInput>): RateLimitResult => {
  const { ipHash, formName, policy } = input
  const now = input.now ?? Date.now()
  const windowMs = policy.windowSeconds * 1000

  const ipKey = composePerIpKey(ipHash, formName)
  const ipExisting = perIpState.get(ipKey) ?? []
  const ipPruned = pruneTimestamps(ipExisting, windowMs, now)

  if (ipPruned.length >= policy.perIp) {
    const oldest = Math.min(...ipPruned)
    perIpState.set(ipKey, ipPruned)
    return {
      ok: false,
      reason: 'rate_limit_per_ip',
      retryAfterSec: computeRetryAfter(oldest, windowMs, now),
    }
  }

  const formExisting = perFormState.get(formName) ?? []
  const formPruned = pruneTimestamps(formExisting, windowMs, now)

  if (formPruned.length >= policy.perForm) {
    const oldest = Math.min(...formPruned)
    perFormState.set(formName, formPruned)
    return {
      ok: false,
      reason: 'rate_limit_per_form',
      retryAfterSec: computeRetryAfter(oldest, windowMs, now),
    }
  }

  perIpState.set(ipKey, [...ipPruned, now])
  perFormState.set(formName, [...formPruned, now])

  return { ok: true }
}
