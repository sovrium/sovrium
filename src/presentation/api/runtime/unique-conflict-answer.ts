/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { CONSTRAINT_MESSAGES } from '@/domain/errors/driver-failure'
import type { SanitizedError } from './error-sanitizer'

/**
 * Whether a sanitized answer is the conflict a taken `unique` value gets.
 *
 * Both producers of that answer in `error-sanitizer.ts` — the tagged
 * `UniqueConstraintViolationError` and a driver failure classified as
 * `unique` — word it with the one {@link CONSTRAINT_MESSAGES} entry, which is
 * what this reads. A road that must answer such a conflict differently to
 * some callers (`tables/unique-conflict-mask.ts`, the agent write tools) asks
 * this instead of comparing the text itself. The co-located test pins every
 * producer to it, so a producer worded on its own fails the test instead of
 * letting the conflict through unrecognised.
 */
export const isUniqueConflictAnswer = (answer: Pick<SanitizedError, 'code' | 'message'>): boolean =>
  answer.code === 'CONFLICT' && answer.message === CONSTRAINT_MESSAGES.unique
