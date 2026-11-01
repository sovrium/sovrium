/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createContext } from 'react'
import type { ConsentPurposes } from '@/domain/models/app/consent'

/**
 * The purposes the app declares, for a `consent-choice` naming one with no label
 * of its own. Absent when the app declares no `consent` block.
 */
export const ConsentPurposesContext = createContext<ConsentPurposes | undefined>(undefined)
