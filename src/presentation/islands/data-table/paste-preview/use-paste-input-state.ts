/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import { type ParsedTsv } from './parse-tsv'
import { buildInitialMappings } from './paste-records'

export function usePasteInputState(tableFields: readonly string[]) {
  const [parsed, setParsed] = useState<ParsedTsv | undefined>(undefined)
  const [mappings, setMappings] = useState<readonly string[]>([])

  const openWith = useCallback(
    (result: ParsedTsv) => {
      setParsed(result)
      setMappings(buildInitialMappings(result.headers, tableFields))
    },
    [tableFields]
  )

  const close = useCallback(() => {
    setParsed(undefined)
    setMappings([])
  }, [])

  const onMappingChange = useCallback((columnIndex: number, value: string) => {
    setMappings((prev) => prev.map((m, i) => (i === columnIndex ? value : m)))
  }, [])

  return { parsed, mappings, openWith, close, onMappingChange }
}
