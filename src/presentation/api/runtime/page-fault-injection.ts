/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { InjectedFaultError } from '@/domain/errors/injected-fault-error'
import {
  SOVRIUM_FAULT_INJECTION_DETAIL_VAR,
  isPageFaultInjected,
} from '@/domain/models/process-env/fault-injection'

/**
 * The non-production `SOVRIUM_FAULT_INJECTION=page:<path>` seam: the render of
 * a request to that URL path throws, exactly as a bug in a page's render would,
 * so the route's own `catch` answers it with the `500` page and keeps the
 * failure under the request id — an engine defect, never a setup fault.
 *
 * Called first by the two render funnels, the operator's pages
 * (`renderWithCache`) and a mounted console's surfaces, each inside the `try`
 * that answers a failed render. Read from the server's environment, like the
 * `action:<automation>` seam; inert under `NODE_ENV=production`.
 */
export const throwIfPageFaultInjected = (path: string): void => {
  if (!isPageFaultInjected(process.env, path)) return
  throw new InjectedFaultError({
    value: `page:${path}`,
    command: 'start',
    cwd: process.cwd(),
    detail: process.env[SOVRIUM_FAULT_INJECTION_DETAIL_VAR],
  })
}
