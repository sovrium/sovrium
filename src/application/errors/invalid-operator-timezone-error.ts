/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createTaggedError } from '@/domain/errors/create-tagged-error'

/**
 * Error raised at server startup when `SOVRIUM_TIMEZONE` names no zone the
 * runtime's time-zone database knows. `cause` is the parser's `Error`, whose
 * message names the variable and the rejected value.
 */
export const InvalidOperatorTimezoneError = createTaggedError('InvalidOperatorTimezoneError')
export type InvalidOperatorTimezoneError = InstanceType<typeof InvalidOperatorTimezoneError>
