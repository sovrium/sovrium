/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useMemo, useState } from 'react'


export interface SharedFilterBindingConfig {
  readonly bindTo?: string
  readonly sharedFilter?: { readonly params?: readonly string[] }
}

type PublishedValue =
  | { readonly kind: 'scalar'; readonly value: string }
  | { readonly kind: 'bag'; readonly value: Record<string, string> }

const EMPTY_PARAMS: Record<string, string> = {}

function selectParams(
  published: PublishedValue,
  params: readonly string[] | undefined
): Record<string, string> {
  if (published.kind === 'scalar') {
    if (params === undefined || params.length === 0) return EMPTY_PARAMS
    return Object.fromEntries(params.map((p) => [p, published.value]))
  }
  const bag = published.value
  const keys = params !== undefined && params.length > 0 ? params : Object.keys(bag)
  return Object.fromEntries(keys.map((k) => [k, bag[k] ?? ''] as const))
}

export function useSharedFilter({
  bindTo,
  sharedFilter,
}: SharedFilterBindingConfig): Record<string, string> {
  const active = Boolean(bindTo) && sharedFilter !== undefined
  const [published, setPublished] = useState<PublishedValue | undefined>(undefined)
  const paramsKey = sharedFilter?.params ? sharedFilter.params.join(',') : ''

  useEffect(() => {
    if (!active || bindTo === undefined) return undefined

    const onSystemQuery = (e: Event): void => {
      const detail = (e as CustomEvent).detail as
        | { params?: Record<string, string>; sourceId?: string }
        | undefined
      if (detail?.params === undefined || detail.sourceId !== bindTo) return
      setPublished({ kind: 'bag', value: detail.params })
    }
    document.addEventListener('island:system-query', onSystemQuery)

    const onSearch = (e: Event): void => {
      const detail = (e as CustomEvent).detail as { query?: string; sourceId?: string } | undefined
      if (detail?.query === undefined || detail.sourceId !== bindTo) return
      setPublished({ kind: 'scalar', value: detail.query })
    }
    document.addEventListener('island:search', onSearch)

    const container = document.getElementById(bindTo)
    const input = container?.querySelector('input') ?? document.querySelector(`#${bindTo} input`)
    const onInput = (e: Event): void =>
      setPublished({ kind: 'scalar', value: (e.target as HTMLInputElement).value })
    input?.addEventListener('input', onInput)
    if (input instanceof HTMLInputElement && input.value !== '') {
      setPublished({ kind: 'scalar', value: input.value })
    }

    return () => {
      document.removeEventListener('island:system-query', onSystemQuery)
      document.removeEventListener('island:search', onSearch)
      input?.removeEventListener('input', onInput)
    }
  }, [active, bindTo])

  const params = sharedFilter?.params
  return useMemo(() => {
    if (!active || published === undefined) return EMPTY_PARAMS
    return selectParams(published, params)
  }, [active, published, params, paramsKey])
}
