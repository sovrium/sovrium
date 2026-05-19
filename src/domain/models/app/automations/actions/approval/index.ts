/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ApprovalRequestActionSchema } from './request'
import type { Schema } from 'effect'

export const ApprovalActionSchema = ApprovalRequestActionSchema

export type ApprovalAction = Schema.Schema.Type<typeof ApprovalActionSchema>

export * from './request'
