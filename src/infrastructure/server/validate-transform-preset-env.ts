/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { parsePresetEnv } from '@/domain/services/image-transform/image-transform-presets'
import { TransformPresetError } from '@/infrastructure/errors/transform-preset-error'

export const validateTransformPresetEnv = (): Effect.Effect<void, TransformPresetError> => {
  const result = parsePresetEnv(process.env.STORAGE_TRANSFORM_PRESETS)
  return result.ok ? Effect.void : Effect.fail(new TransformPresetError(result.error))
}
