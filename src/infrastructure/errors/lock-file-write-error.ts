/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createTaggedError } from '@/domain/errors/create-tagged-error'

/**
 * Error class for a lock file that could not be written.
 *
 * Never fatal — a server without a lock file still serves every request
 * correctly. It is typed rather than discarded because the CONSEQUENCE lands
 * somewhere else entirely: `sovrium stop` and `sovrium restart` find the running
 * process through that file, so a silent failure at boot becomes an inexplicable
 * "no server running" the next time an operator tries to stop one.
 */
export const LockFileWriteError = createTaggedError('LockFileWriteError')
export type LockFileWriteError = InstanceType<typeof LockFileWriteError>
