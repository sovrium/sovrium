/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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
 *
 * Z-1 ($currentUser references in dataSource.filter):
 * - `email` enables `$currentUser.email` filter resolution.
 * - `isUnrestricted` enables `$currentUser.isUnrestricted` bypass for
 *   global engineers (Better Auth admin role) — when true, the engine
 *   skips assignment-scoped filters and shows all records.
 *
 * Both fields are optional for backward compatibility with existing
 * consumers that only need user id / role.
 */
export interface SessionInfo {
  readonly userId: string
  readonly role: string
  readonly email?: string
  readonly isUnrestricted?: boolean
}
