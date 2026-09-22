/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createTaggedError } from '@/domain/errors/create-tagged-error'

/**
 * Error class for an in-place `--watch` handler swap that could not be applied.
 *
 * The listener is still bound and still serving the PREVIOUS handler when this
 * is raised: the new Hono app is built before the swap, so anything that fails
 * fails before the live server has been touched. The watcher reports it and
 * keeps the operator's port.
 */
export const ServerReloadError = createTaggedError('ServerReloadError')
export type ServerReloadError = InstanceType<typeof ServerReloadError>
