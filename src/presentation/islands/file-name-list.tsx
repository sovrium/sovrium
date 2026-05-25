/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'

interface FileNameListProps {
  readonly fileNames: readonly string[]
}

export function FileNameList({ fileNames }: FileNameListProps): ReactElement {
  return (
    <ul className="text-foreground text-xs">
      {fileNames.map((name) => (
        <li key={name}>{name}</li>
      ))}
    </ul>
  )
}
