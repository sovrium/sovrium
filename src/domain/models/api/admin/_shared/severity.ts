/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'

export const severitySchema = z
  .enum(['debug', 'info', 'warning', 'error', 'critical'])
  .describe('Severity classification used for filtering and alerting')

export type Severity = z.infer<typeof severitySchema>
