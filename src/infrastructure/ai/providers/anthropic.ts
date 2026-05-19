/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { AiEnvConfig } from '@/domain/models/env/ai'

export const createAnthropicClient = (config: AiEnvConfig): Anthropic =>
  new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  })
