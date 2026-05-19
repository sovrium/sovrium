/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AutoSaveConfigSchema } from '../../auto-save'
import { ComponentSearchSchema } from '../../component-search'
import { DataSourceSchema } from '../../data-source'

export const dataBoundFields = {
  dataSource: Schema.optional(DataSourceSchema),
  autoSave: Schema.optional(AutoSaveConfigSchema),
  search: Schema.optional(ComponentSearchSchema),
} as const
