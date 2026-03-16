/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data } from 'effect'

/**
 * Error when user fields are used without auth configuration
 *
 * User fields (user, created-by, updated-by) require Better Auth's users table.
 * This error is thrown when tables with these field types are defined but
 * no auth configuration is present in the app schema.
 */
export class AuthConfigRequiredForUserFields extends Data.TaggedError(
  'AuthConfigRequiredForUserFields'
)<{
  readonly message: string
}> {}
