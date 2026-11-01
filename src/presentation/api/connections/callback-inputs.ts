/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Context } from 'hono'

export interface CallbackInputs {
  readonly code: string
  readonly state: string
  readonly name: string
}

export const parseCallbackInputs = (
  c: Context
): CallbackInputs | { readonly error: string; readonly status: 400 } => {
  const name = c.req.param('name')
  const code = c.req.query('code')
  const state = c.req.query('state')
  if (name === undefined) return { error: 'connection_name_required', status: 400 as const }
  if (code === undefined || code === '' || state === undefined || state === '') {
    return { error: 'missing_code_or_state', status: 400 as const }
  }
  return { code, state, name }
}
