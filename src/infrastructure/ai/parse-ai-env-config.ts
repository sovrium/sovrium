/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Re-export of the canonical AI env-config parser from the domain layer.
 *
 * The domain model defines the schema (`AiEnvSchema`) and parser
 * (`parseAiEnvConfig`); this infrastructure-layer barrel exists so
 * AI-adapter code can import from a single neighbour file without
 * reaching across to `@/domain/models/env/ai`. Mirrors the convention
 * used by `parseStorageEnvConfig` consumers.
 */

export { parseAiEnvConfig } from '@/domain/models/env/ai'
export type { AiEnvConfig } from '@/domain/models/env/ai'
