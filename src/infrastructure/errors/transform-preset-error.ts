/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createTaggedError } from '@/domain/errors/create-tagged-error'

/**
 * Error class for a malformed `STORAGE_TRANSFORM_PRESETS` env var.
 *
 * Raised at server startup when the operator-supplied image-transform preset
 * configuration is invalid JSON, a non-object value, or carries a preset name
 * that is not alphanumeric-with-hyphens. A tagged
 * error keeps it discriminable in the Effect failure channel — a bare global
 * `Error` would merge untagged with every other failure.
 */
export const TransformPresetError = createTaggedError('TransformPresetError')
export type TransformPresetError = InstanceType<typeof TransformPresetError>
