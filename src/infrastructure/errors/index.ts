/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Infrastructure Error Classes Module
 *
 * Centralized error definitions for infrastructure layer failures.
 * All errors use tagged union pattern (_tag property) for type-safe error handling.
 *
 * @example
 * ```typescript
 * import { ServerCreationError } from '@/infrastructure/errors'
 *
 * throw new ServerCreationError(error)
 * ```
 */

export { AuthConfigRequiredForUserFields } from './auth-config-required-error'
export { AuthError } from './auth-error'
export { CSSCompilationError } from './css-compilation-error'
export { SchemaInitializationError } from './schema-initialization-error'
export { ServerCreationError } from './server-creation-error'
