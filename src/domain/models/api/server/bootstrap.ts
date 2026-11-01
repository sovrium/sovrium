/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/** Response schema for `POST /api/admin/bootstrap/claim`. */
export const bootstrapClaimResponseSchema = Schema.Struct({
  success: Schema.Literal(true).annotate({ description: 'The token was claimed' }),
  userId: Schema.String.annotate({ description: 'Id of the administrator just created' }),
  email: Schema.String.annotate({ description: 'Address of the administrator just created' }),
})
