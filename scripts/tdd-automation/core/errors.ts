/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Data } from 'effect'

export class CreditsExhausted extends Data.TaggedError('CreditsExhausted')<{
  readonly probeResult: {
    readonly rawJson: string
    readonly errorMessage?: string
  }
}> {}

export class ActiveTDDPRExists extends Data.TaggedError('ActiveTDDPRExists')<{
  readonly prNumber: number
  readonly specId: string
}> {}

export class ForgejoApiError extends Data.TaggedError('ForgejoApiError')<{
  readonly operation: string
  readonly cause: unknown
}> {}

export class GitOperationError extends Data.TaggedError('GitOperationError')<{
  readonly operation: string
  readonly stderr: string
}> {}

export type TDDAutomationError =
  | CreditsExhausted
  | ActiveTDDPRExists
  | ForgejoApiError
  | GitOperationError
