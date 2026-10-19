/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import type { Context } from 'hono'

/**
 * The answer to a press of a control that is disabled on the record it names
 * — a button field, a row action, a record-bound button: 409 `ACTION_DISABLED`
 * with the control's reason as the message (already read from what the
 * presser may read). Shared by the button-field route and `form-action`, the
 * two roads a press names its record on.
 */
export const pressDisabledResponse = (c: Context, message: string): Response =>
  c.json({ success: false, code: ApiErrorCode.ACTION_DISABLED, message }, 409)
