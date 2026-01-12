/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createTaggedError } from '@/domain/errors/create-tagged-error'

/**
 * Error class for server creation failures
 */
export const ServerCreationError = createTaggedError('ServerCreationError')
export type ServerCreationError = InstanceType<typeof ServerCreationError>
