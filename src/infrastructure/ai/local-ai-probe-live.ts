/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { LocalAiProbe } from '@/application/ports/services/local-ai-probe'
import { probeOllamaReachable } from './ollama-reachability'

/** Live `LocalAiProbe` — the bounded Ollama `/api/tags` round trip. */
export const LocalAiProbeLive = Layer.succeed(
  LocalAiProbe,
  LocalAiProbe.of({
    isReachable: (baseUrl) =>
      // effect-promise: total -- probeOllamaReachable wraps its whole fetch in a try/catch returning false and returns false early for an unset base URL
      Effect.promise(() => probeOllamaReachable(baseUrl)),
  })
)
