/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveEnvInString } from '@/domain/models/app/env-reference-service'
import { mapStringsDeep } from './value-walker'

/**
 * The `$env` resolver lives in the domain (`env-reference-service.ts`) so the
 * infrastructure that sends outgoing webhooks can share it without reaching
 * into this layer. Re-exported here for the automation runner and the routes
 * that already import it from this module.
 */
export {
  buildEnvLookup,
  ENV_REFERENCE_PATTERN,
  resolveEnvInString,
  resolveSecretInString,
} from '@/domain/models/app/env-reference-service'

/**
 * Recursively walk a value and resolve `$env.VAR_NAME` placeholders inside
 * any string leaves. Arrays and plain objects are traversed structurally;
 * other values (numbers, booleans, null, undefined) pass through unchanged.
 *
 * Pure: takes a precomputed env lookup so the function stays trivially
 * testable. The structural traversal is owned by `mapStringsDeep`.
 */
export const resolveEnvInValue = (
  value: unknown,
  envLookup: Readonly<Record<string, string>>
): unknown => mapStringsDeep(value, (s) => resolveEnvInString(s, envLookup))
