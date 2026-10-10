/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The names the two-step sign-in is stored under, shared by the hook that
 * writes the kept destination (`two-factor-destination.ts`) and the page
 * reader (`two-factor-attempt-reader.ts`). A module of its own, importing
 * nothing of Better Auth, so the page reader never loads it eagerly.
 */

/** The cookie's base name, as Better Auth's two-factor plugin names it. */
export const TWO_FACTOR_COOKIE = 'two_factor'

/** The `verification` identifier of the destination kept beside attempt `attemptId`. */
export const destinationIdentifier = (attemptId: string): string => `2fa-destination-${attemptId}`
