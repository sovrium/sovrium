/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A signing request summed up for whoever lists it: when it ended, its signers
 * as one line, and its record as one line. Pure over what the store answers;
 * nothing here reads an address, a token or a digest, because nothing here is
 * given one.
 */

import { signerStatusOf } from './signature-request-service'

/** When a request ended, as a reader is shown it: completion, or the deadline of an expiry. */
export const requestEndedAt = (request: {
  readonly status: string
  readonly completedAt?: string | undefined
  readonly expiresAt?: string | undefined
}): string | undefined => {
  if (request.completedAt !== undefined) return request.completedAt
  // An expired request ended at its deadline (`requestEndedAtMs`), the instant its retention counts from.
  return request.status === 'expired' ? request.expiresAt : undefined
}

/**
 * Every signer in order as one line: each by the name the request was sent to
 * her under (her name in the flow once that is gone) and her status, in the
 * words the API uses (`Ada Lovelace: sent · Grace Hopper: waiting`).
 */
export const signersSummary = (
  signers: readonly {
    readonly name: string
    readonly status: string
    readonly position: number
    readonly displayName?: string | undefined
  }[]
): string =>
  signers
    .toSorted((left, right) => left.position - right.position)
    .map((signer) => {
      const shown = signer.displayName?.trim() ? signer.displayName.trim() : signer.name
      return `${shown}: ${signerStatusOf(signer.status)}`
    })
    .join(' · ')

/** The record a request is for, as one line: its table and its id. */
export const requestRecordLabel = (request: {
  readonly tableName: string
  readonly recordId: string
}): string => `${request.tableName} · ${request.recordId}`

/** Whether `term` (already trimmed) occurs in any of `texts`, case ignored, matched literally. */
export const matchesSearchTerm = (texts: readonly string[], term: string | undefined): boolean => {
  if (term === undefined || term === '') return true
  const needle = term.toLowerCase()
  return texts.some((text) => text.toLowerCase().includes(needle))
}
