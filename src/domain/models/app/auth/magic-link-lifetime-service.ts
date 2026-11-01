/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getStrategy } from './auth'
import type { Auth } from './auth'

/** A link's lifetime when the strategy leaves `expirationMinutes` unset. */
export const DEFAULT_MAGIC_LINK_EXPIRATION_MINUTES = 15

/**
 * How long a magic link lives, in minutes: what the sign-in plugin enforces
 * and what the magic-link mail states. Pure, so the mail can read it without
 * loading the authentication package.
 */
export const magicLinkExpirationMinutes = (authConfig?: Auth): number =>
  getStrategy(authConfig, 'magicLink')?.expirationMinutes ?? DEFAULT_MAGIC_LINK_EXPIRATION_MINUTES
