/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAiComputeFieldType } from './tables/fields/field-types/ai/ai-field-types'
import type { App } from './app'

/**
 * The `LISTEN` connections an app opens on PostgreSQL: one when a table carries
 * an AI compute field (the compute listener), one when an agent declares
 * knowledge tables (the knowledge listener). 0, 1 or 2.
 *
 * Counted from the config alone, so a start can size its connection budget
 * (`planDatabaseConnections`) before anything connects. The knowledge count
 * errs on the side of reserving: an agent whose role later filters every table
 * out still keeps its slot.
 */
export const countDatabaseListeners = (app: Readonly<App>): number => {
  const computes = (app.tables ?? []).some((table) =>
    table.fields.some((field) => isAiComputeFieldType(field.type))
  )
  const knows = (app.agents ?? []).some((agent) => (agent.knowledge?.tables ?? []).length > 0)
  return (computes ? 1 : 0) + (knows ? 1 : 0)
}
