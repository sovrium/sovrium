/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { twoFactor } from 'better-auth/plugins'
import type { Auth } from '@/domain/models/app/auth'

/**
 * Two-factor table name
 */
export const TWO_FACTOR_TABLE_NAME = '_sovrium_auth_two_factors'

/**
 * Build two-factor plugin if enabled in auth configuration
 */
export const buildTwoFactorPlugin = (authConfig?: Auth) =>
  authConfig?.twoFactor
    ? [twoFactor({ schema: { twoFactor: { modelName: TWO_FACTOR_TABLE_NAME } } })]
    : []
