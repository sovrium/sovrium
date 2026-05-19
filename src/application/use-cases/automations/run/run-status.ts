/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export const toApiStatus = (
  engineStatus: 'success' | 'failure' | 'timed-out' | 'exhausted' | 'completed-with-errors'
): 'completed' | 'failed' | 'timed-out' | 'exhausted' | 'completed-with-errors' => {
  if (engineStatus === 'success') return 'completed'
  if (engineStatus === 'timed-out') return 'timed-out'
  if (engineStatus === 'exhausted') return 'exhausted'
  if (engineStatus === 'completed-with-errors') return 'completed-with-errors'
  return 'failed'
}

export const toApiStepStatus = (
  engineStatus: 'success' | 'failure' | 'skipped'
): 'completed' | 'failed' | 'skipped' => {
  if (engineStatus === 'success') return 'completed'
  if (engineStatus === 'skipped') return 'skipped'
  return 'failed'
}
