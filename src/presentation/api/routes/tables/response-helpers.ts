/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { Context } from 'hono'

export const forbiddenCreateResponse = (c: Context): Response =>
  c.json(
    {
      success: false,
      message: 'You do not have permission to create records in this table',
      code: 'FORBIDDEN',
    },
    403
  )

export const forbiddenCreateScopeResponse = (c: Context): Response =>
  c.json(
    {
      success: false,
      message: 'You do not have permission to create records outside your scope',
      code: 'FORBIDDEN',
    },
    403
  )
