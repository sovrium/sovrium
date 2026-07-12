/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import { buildSystemQueryUrl } from '../shared/system-query-url'
import type { KpiSystemSource } from '@/domain/models/app/pages/components/component-types/data/kpi'


export const KPI_NEUTRAL_VALUE = '—'

export type KpiSystemValue =
  | { readonly kind: 'value'; readonly value: number }
  | { readonly kind: 'template'; readonly value: string }
  | { readonly kind: 'neutral' }

function readDottedPath(envelope: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc === null || acc === undefined || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[segment]
  }, envelope)
}

function resolveSystemValue(system: KpiSystemSource, envelope: unknown): KpiSystemValue {
  if (system.valueTemplate !== undefined) {
    const tokens = [...system.valueTemplate.matchAll(/\{([^}]+)\}/g)]
    const allResolved = tokens.every((match) => {
      const raw = readDottedPath(envelope, match[1] ?? '')
      return typeof raw === 'string' || (typeof raw === 'number' && Number.isFinite(raw))
    })
    if (tokens.length === 0 || !allResolved) return { kind: 'neutral' }
    const value = system.valueTemplate.replace(/\{([^}]+)\}/g, (_, path: string) =>
      String(readDottedPath(envelope, path))
    )
    return { kind: 'template', value }
  }

  if (system.valuePath !== undefined) {
    const raw = readDottedPath(envelope, system.valuePath)
    if (raw === null || raw === undefined) return { kind: 'neutral' }
    const num = Number(raw)
    if (!Number.isFinite(num)) return { kind: 'neutral' }
    return { kind: 'value', value: num }
  }

  return { kind: 'neutral' }
}

const AUTH_DENIAL_STATUSES = new Set([401, 403, 404])

type EnvelopeResult =
  | { readonly kind: 'envelope'; readonly envelope: unknown }
  | { readonly kind: 'denied' }

export function useKpiSystemValue(system: KpiSystemSource | undefined) {
  return useQuery({
    queryKey: ['kpi-system-value', system?.endpoint, system?.query],
    enabled: Boolean(system?.endpoint),
    queryFn: async (): Promise<EnvelopeResult> => {
      if (!system?.endpoint) return { kind: 'denied' }
      const res = await fetch(buildSystemQueryUrl(system), { credentials: 'include' })
      if (AUTH_DENIAL_STATUSES.has(res.status)) return { kind: 'denied' }
      if (!res.ok) {
        throw new Error(`KPI system endpoint failed: ${String(res.status)}`)
      }
      const envelope = (await res.json()) as unknown
      return { kind: 'envelope', envelope }
    },
    select: (result: EnvelopeResult): KpiSystemValue =>
      result.kind === 'denied' || !system
        ? { kind: 'neutral' }
        : resolveSystemValue(system, result.envelope),
  })
}
