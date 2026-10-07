/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createContext } from 'react'

/**
 * Whether the form puts its labels BESIDE their controls (`labelPlacement:
 * side`). Read through context so the field renderers keep their signatures.
 */
export const SideLabelsContext = createContext(false)
