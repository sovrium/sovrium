/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Auth } from '@/domain/models/app/auth'

export const DEFAULT_PASSWORD_MIN_LENGTH = 8

export const DEFAULT_PASSWORD_MAX_LENGTH = 128

export interface PasswordPolicy {
  readonly minLength: number
  readonly maxLength: number
}

export const resolvePasswordPolicy = (authConfig?: Auth): PasswordPolicy => {
  const strategy = authConfig?.strategies?.find((s) => s.type === 'emailAndPassword')
  const minLength =
    strategy && 'minPasswordLength' in strategy && typeof strategy.minPasswordLength === 'number'
      ? strategy.minPasswordLength
      : DEFAULT_PASSWORD_MIN_LENGTH
  const maxLength =
    strategy && 'maxPasswordLength' in strategy && typeof strategy.maxPasswordLength === 'number'
      ? strategy.maxPasswordLength
      : DEFAULT_PASSWORD_MAX_LENGTH
  return { minLength, maxLength }
}
