/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { toFiniteCount } from '@/domain/utils/database/count-coercion'
import type { AdminFormAggregateRow } from '@/application/ports/repositories/forms/admin-forms-repository'

export const sumSubmissionCounts = (aggregates: ReadonlyArray<AdminFormAggregateRow>): number =>
  aggregates.reduce((acc: number, aggregate) => acc + toFiniteCount(aggregate.submissionCount), 0)
