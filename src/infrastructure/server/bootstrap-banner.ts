/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { StartupPhase } from '@/infrastructure/logging/logger'

const BOOTSTRAP_TOKEN_TTL_MINUTES = 60

const BOOTSTRAP_CLAIM_ENDPOINT = '/api/admin/bootstrap/claim'

export interface BootstrapTokenAttachment {
  readonly plaintext: string
  readonly claimEndpoint: string
  readonly expiresInMinutes: number
}

export interface BootstrapTokenSummaryParts {
  readonly phases: readonly StartupPhase[]
  readonly bootstrapToken?: BootstrapTokenAttachment
}

export const applyBootstrapTokenToSummary = (
  phases: readonly StartupPhase[],
  bootstrapToken: string | undefined
): BootstrapTokenSummaryParts => {
  if (!bootstrapToken) return { phases }
  const warning: StartupPhase = {
    label: 'No admin user — claim one within 1 hour with the token below',
    type: 'warning' as const,
  }
  return {
    phases: [warning, ...phases],
    bootstrapToken: {
      plaintext: bootstrapToken,
      claimEndpoint: BOOTSTRAP_CLAIM_ENDPOINT,
      expiresInMinutes: BOOTSTRAP_TOKEN_TTL_MINUTES,
    },
  }
}
