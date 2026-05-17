/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/prefer-immutable-types */
import OpenAI from 'openai'
import type { AiEnvConfig } from '@/domain/models/env/ai'

/** @public */
export const createOpenAIClient = (config: AiEnvConfig): OpenAI =>
  new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  })
