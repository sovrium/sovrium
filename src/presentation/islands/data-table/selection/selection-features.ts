/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { rowSelectionFeature } from '@tanstack/react-table'

/** The selection slot's slice of the grid's feature registry: row selection. */
export const selectionFeatures = { rowSelectionFeature } as const
