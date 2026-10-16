/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isEmailConfigured } from '@/infrastructure/process/env'
import type { EmbeddedAppMount } from '@/application/ports/contracts/embedded-app-mount'

/**
 * Whether a path is reachable without a session, for THIS mount.
 *
 * The sign-in card is public unconditionally — losing outgoing mail must never
 * cost the operator their way in. The recovery pair is public only while SMTP
 * is configured: a recovery form that can never mail anything is worse than no
 * form at all, so without mail it is absent rather than broken.
 */
export const isPublicMountPath = (mount: EmbeddedAppMount, path: string): boolean => {
  if (!mount.publicPaths.has(path)) return false
  return !mount.mailGatedPublicPaths.has(path) || isEmailConfigured()
}
