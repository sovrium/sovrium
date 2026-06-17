/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { PlainSelect } from './plain-select'
import { SearchableSelect } from './searchable-select'
import type { SelectIslandProps } from './select-island-types'
import type { ReactElement } from 'react'


export default function SelectIsland(props: SelectIslandProps): ReactElement {
  return props.searchable ? <SearchableSelect {...props} /> : <PlainSelect {...props} />
}
