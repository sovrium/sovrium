/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { APIError } from 'better-auth/api'
import { ApiErrorCode, NOT_FOUND_ERROR, NOT_FOUND_MESSAGE } from '@/domain/models/api/error'

/**
 * A `before`-hook refusal in the one 404 body every `/api/*` road answers
 * (`{ success, error, message, code }`), the answer a route that does not
 * exist gives. Thrown before Better Auth's handler runs, so it never reaches
 * the presentation layer's own 403-to-404 rewrite — and some routes are
 * forwarded to Better Auth outside that rewrite anyway.
 */
export const notFoundError = (): APIError =>
  new APIError('NOT_FOUND', {
    success: false,
    error: NOT_FOUND_ERROR,
    message: NOT_FOUND_MESSAGE,
    code: ApiErrorCode.NOT_FOUND,
  })
