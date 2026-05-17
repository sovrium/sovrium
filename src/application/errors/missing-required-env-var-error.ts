/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createTaggedError } from '@/domain/errors/create-tagged-error'

/**
 * Error raised at server startup when an env var declared with `required: true`
 * is not set in the OS environment AND has no `default` value defined.
 *
 * Required env vars without defaults must be present at startup so automations
 * relying on them (via `$env.VAR_NAME` or `{{env "VAR_NAME"}}`) cannot fail
 * mid-execution due to missing secrets.
 */
export const MissingRequiredEnvVarError = createTaggedError('MissingRequiredEnvVarError')
export type MissingRequiredEnvVarError = InstanceType<typeof MissingRequiredEnvVarError>
