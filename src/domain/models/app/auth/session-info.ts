/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Lightweight session information for page access control
 *
 * This is a domain-level type that represents the minimal session
 * data needed to make access control decisions. It is intentionally
 * decoupled from the full Better Auth session to keep the domain
 * layer free of infrastructure concerns.
 */
export interface SessionInfo {
  readonly userId: string
  readonly role: string
}
