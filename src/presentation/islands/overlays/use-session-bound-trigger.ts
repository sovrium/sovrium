/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect } from 'react'
import { hydrateSessionBindings } from '@/presentation/islands/runtime/session-resolver'

/**
 * Resolve every session-bound marker this island just mounted.
 *
 * The trigger's content is injected on MOUNT, after the page-load session pass
 * has already run and found nothing to fill, so the island has to ask for
 * itself. The markers carry TEMPLATES rather than resolved values and stay on
 * their elements, which is what makes asking again idempotent.
 */
export function useSessionBoundTrigger(): void {
  useEffect(() => {
    hydrateSessionBindings(document)
  }, [])
}
