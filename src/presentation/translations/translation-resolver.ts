/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Re-export translation resolver functions from domain layer
 *
 * These pure functions were moved to the domain layer to respect layer boundaries.
 * This file re-exports them for backward compatibility with existing presentation
 * layer code. Application layer code should import directly from domain.
 *
 * @see src/domain/utils/translation-resolver.ts for implementation
 */
export {
  normalizeLanguageCode,
  resolveTranslation,
  resolveTranslationPattern,
  collectTranslationsForKey,
} from '@/domain/utils/translation-resolver'
