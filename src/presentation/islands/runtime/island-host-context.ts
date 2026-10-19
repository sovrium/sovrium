/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createContext } from 'react'

/**
 * The `id` of the element an island is mounted into — the author's `props.id`,
 * which the server writes onto the island host — or `undefined` when the host
 * carries none.
 *
 * The mounter provides it around every island, so a hook deep inside one can
 * answer to a sibling that names the component, as `onSuccess.refetch` does,
 * without each island threading its id down by hand.
 */
export const IslandHostIdContext = createContext<string | undefined>(undefined)
