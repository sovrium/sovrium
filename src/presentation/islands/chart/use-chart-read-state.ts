/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { settledReadState } from '@/domain/models/app/pages/read-state-gate-service'
import { useReadState } from '../hooks/use-read-state'

/**
 * Announce what the chart last read to the buttons that follow it
 * (`hiddenWhenRead`, `disabledWhenRead`): by its host's `props.id`, and on
 * the shared-filter channel its table binding subscribes to.
 */
export function useChartReadState(
  dataSource: unknown,
  read: {
    readonly records: readonly unknown[]
    readonly isLoading: boolean
    readonly isError: boolean
  }
): void {
  const { bindTo } = (dataSource ?? {}) as { readonly bindTo?: unknown }
  useReadState(
    typeof bindTo === 'string' ? bindTo : undefined,
    settledReadState(read.isError, read.isLoading ? undefined : read.records.length)
  )
}
