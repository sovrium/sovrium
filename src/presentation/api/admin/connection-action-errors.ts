/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ApiErrorCode } from '@/domain/models/api/error'
import { errorBody } from '@/presentation/api/runtime/auth-helpers'
import type { Context } from 'hono'

/**
 * Status -> canonical code and human-readable wording for a connection action.
 *
 * `satisfies` is the point: widening {@link actionError}'s status union without
 * deciding what the new status MEANS breaks this table at compile time, rather
 * than letting the new status inherit whatever the last branch happened to say.
 */
const ACTION_ERROR_BY_STATUS = {
  400: { code: ApiErrorCode.BAD_REQUEST, message: 'The connection action was refused' },
  500: { code: ApiErrorCode.INTERNAL_ERROR, message: 'The connection action failed' },
  502: {
    code: ApiErrorCode.BAD_GATEWAY,
    message: 'The connection provider could not be reached',
  },
} satisfies Record<400 | 500 | 502, { readonly code: ApiErrorCode; readonly message: string }>

/**
 * A connection-action refusal.
 *
 * Builds the canonical envelope rather than a bare `{ error }` — which would be
 * a second wire shape, with no `message` for a human and no `code` to branch
 * on — and keeps the short slug in `error`,
 * which is what `[internal ref]` matches on.
 */
export const actionError = (c: Context, status: 400 | 500 | 502, error: string) =>
  c.json(errorBody({ error, ...ACTION_ERROR_BY_STATUS[status] }), status)
