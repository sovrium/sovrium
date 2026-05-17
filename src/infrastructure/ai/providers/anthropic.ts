/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/prefer-immutable-types */
import Anthropic from '@anthropic-ai/sdk'
import type { AiEnvConfig } from '@/domain/models/env/ai'

/** @public */
export const createAnthropicClient = (config: AiEnvConfig): Anthropic =>
  new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  })
