/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'


export const connectionError = (
  c: Context,
  status: ContentfulStatusCode,
  error: string,
  extras?: { readonly message?: string; readonly detail?: unknown }
) =>
  c.json(
    {
      error,
      ...(extras?.message !== undefined ? { message: extras.message } : {}),
      ...(extras?.detail !== undefined ? { detail: extras.detail } : {}),
    },
    status
  )
