/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ComponentSearchSchema } from './component-search'

/**
 * Data table search configuration.
 *
 * Re-exports ComponentSearchSchema for backward compatibility.
 * All data-bound components (data-table, kanban, calendar) share the
 * same search bar configuration via ComponentSearchSchema.
 *
 * @example
 * ```yaml
 * search:
 *   enabled: true
 *   placeholder: Search orders...
 *   debounceMs: 300
 *   highlight: true
 * ```
 */
export const DataTableSearchSchema = ComponentSearchSchema

export type DataTableSearch = typeof DataTableSearchSchema.Type
