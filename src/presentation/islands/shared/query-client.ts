/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { QueryClient } from '@tanstack/react-query'

/**
 * Creates a QueryClient instance for an island root.
 *
 * Each island gets its own QueryClient to ensure isolation —
 * cache invalidation in one island doesn't cause unnecessary
 * refetches in unrelated islands.
 */
export function createIslandQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 2,
        refetchOnWindowFocus: true,
      },
    },
  })
}
