/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createTaggedError } from '@/domain/errors/create-tagged-error'

/**
 * Error raised at server startup when an operator-email or automation-engine
 * variable holds a value its parser refuses — `SOVRIUM_NOTIFY_AUTOMATIONS`
 * neither `on` nor `off`, an entry of `SOVRIUM_NOTIFY_TO` that is not an email
 * address, a `SOVRIUM_AUTOMATION_DEFAULT_TIMEOUT_MS` outside its range, and so
 * on. `cause` is the parser's `Error`, whose message names the variable and the
 * rejected value.
 */
export const InvalidNotificationEnvError = createTaggedError('InvalidNotificationEnvError')
export type InvalidNotificationEnvError = InstanceType<typeof InvalidNotificationEnvError>
