/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export interface SessionInfo {
  readonly userId: string
  readonly role: string
  readonly email?: string
  readonly isUnrestricted?: boolean
  readonly groups?: readonly string[]
}
