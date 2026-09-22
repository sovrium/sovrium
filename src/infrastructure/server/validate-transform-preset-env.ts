/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { parsePresetEnv } from '@/domain/models/app/buckets/image-transform-presets'
import { TransformPresetError } from '@/infrastructure/errors/transform-preset-error'

/**
 * Fail-fast on a malformed `STORAGE_TRANSFORM_PRESETS` env var (invalid JSON, a
 * non-object value, or a preset name that is not alphanumeric-with-hyphens).
 * An operator misconfiguring image-transform presets must be caught at startup,
 * not on the first `?preset=` request.
 */
export const validateTransformPresetEnv: Effect.Effect<void, TransformPresetError> =
  // `Effect.suspend`, not a bare expression: `parsePresetEnv` reads `process.env`
  // EAGERLY, so hoisting it to module scope would both run it at import time and
  // freeze the value a test sets afterwards. Suspending keeps the read per-run.
  Effect.suspend(() => {
    const result = parsePresetEnv(process.env.STORAGE_TRANSFORM_PRESETS)
    return result.ok ? Effect.void : Effect.fail(new TransformPresetError(result.error))
  })
