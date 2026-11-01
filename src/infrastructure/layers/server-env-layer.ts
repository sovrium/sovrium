/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { ProcessEnv } from '@/application/ports/services/process-env'
import { ServerEnv } from '@/application/ports/services/server-env'
import { parseServerEnv } from '@/domain/models/process-env/server'
import { ProcessEnvLayer } from '@/infrastructure/layers/process-env-layer'

/**
 * The server's environment, decoded once from `ProcessEnv` when a
 * composition root builds its layer.
 *
 * Built where the root is built, never at module load: `sovrium build` sets
 * `BASE_URL` to its published origin before it provides the static-build
 * layer, so the record that build reads already carries it.
 */
const ServerEnvFromProcessEnv = Layer.effect(ServerEnv, Effect.map(ProcessEnv, parseServerEnv))

/**
 * `ProcessEnv` and the `ServerEnv` decoded from it: what each composition root
 * provides, so the two always describe one environment.
 */
export const EnvironmentLayer = ServerEnvFromProcessEnv.pipe(Layer.provideMerge(ProcessEnvLayer))
