/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { TDDPRTitle } from './types'

const TDD_TITLE_REGEX =
  /^\[TDD\]\s+Implement\s+([A-Z]+-[A-Z-]+-(?:\d{3}|REGRESSION))\s*\|\s*Attempt\s+(\d+)\/(\d+)$/i

const TDD_V4_TITLE_REGEX =
  /^\[TDD-V4\]\s+Implement\s+([a-z0-9][a-z0-9-]*)\s*\|\s*Attempt\s+(\d+)\/(\d+)$/i

export type ParsedTDDPRTitle =
  | {
      readonly kind: 'v3'
      readonly specId: string
      readonly attempt: number
      readonly maxAttempts: number
    }
  | {
      readonly kind: 'v4'
      readonly slug: string
      readonly attempt: number
      readonly maxAttempts: number
    }

export function parseTDDPRTitle(title: string): TDDPRTitle | null {
  const match = title.match(TDD_TITLE_REGEX)

  if (!match) {
    return null
  }

  const [, specId, attemptStr, maxAttemptsStr] = match

  if (!specId || !attemptStr || !maxAttemptsStr) {
    return null
  }

  return {
    specId: specId.toUpperCase(),
    attempt: parseInt(attemptStr, 10),
    maxAttempts: parseInt(maxAttemptsStr, 10),
  }
}

export function parseTDDV4PRTitle(
  title: string
): { readonly slug: string; readonly attempt: number; readonly maxAttempts: number } | null {
  const match = title.match(TDD_V4_TITLE_REGEX)

  if (!match) {
    return null
  }

  const [, slug, attemptStr, maxAttemptsStr] = match

  if (!slug || !attemptStr || !maxAttemptsStr) {
    return null
  }

  return {
    slug: slug.toLowerCase(),
    attempt: parseInt(attemptStr, 10),
    maxAttempts: parseInt(maxAttemptsStr, 10),
  }
}

export function parseAnyTDDPRTitle(title: string): ParsedTDDPRTitle | null {
  const v3 = parseTDDPRTitle(title)
  if (v3) {
    return {
      kind: 'v3',
      specId: v3.specId,
      attempt: v3.attempt,
      maxAttempts: v3.maxAttempts,
    }
  }
  const v4 = parseTDDV4PRTitle(title)
  if (v4) {
    return {
      kind: 'v4',
      slug: v4.slug,
      attempt: v4.attempt,
      maxAttempts: v4.maxAttempts,
    }
  }
  return null
}

export function isTDDPRTitle(title: string): boolean {
  return TDD_TITLE_REGEX.test(title)
}

export function isTDDV4PRTitle(title: string): boolean {
  return TDD_V4_TITLE_REGEX.test(title)
}

export function extractSpecIdFromBranch(branchName: string): string | null {
  const match = branchName.match(/^tdd\/(.+)$/i)

  if (!match || !match[1]) {
    return null
  }

  return match[1].toUpperCase()
}

export function extractSlugFromV4Branch(branchName: string): string | null {
  const match = branchName.match(/^tdd-v4\/(.+)$/i)

  if (!match || !match[1]) {
    return null
  }

  return match[1].toLowerCase()
}
