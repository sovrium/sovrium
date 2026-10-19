/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import { useLiveRefresh } from '../hooks/use-realtime-subscription'
import {
  fetchSystemEnvelope,
  systemEnvelopeQueryKey,
  type SystemEnvelopeResult,
} from '../runtime/system-envelope-query'
import type { KpiSystemSource } from '@/domain/models/app/pages/components/component-types/data/kpi'

/**
 * Client-side system value-path binding for the KPI component
 *.
 *
 * When a KPI declares `dataSource.system`, it reads a single PRE-COMPUTED scalar
 * from a system read endpoint instead of aggregating a DB table:
 *  - the hook fetches `system.endpoint` (merging `system.query` static params);
 *  - reads the scalar at `valuePath` (a dotted path into the JSON envelope), OR
 *  - interpolates `{dotted.path}` tokens in `valueTemplate` from the SAME envelope.
 *
 * GAP-I1 graceful degrade (mirrors `useKpiRecords`): a fetch failure, a non-2xx
 * (incl. the 401/403/404 an anonymous visitor gets on the admin-gated endpoint),
 * or a missing path resolves to a NEUTRAL value — the island renders its
 * server-known label with the conventional em-dash placeholder, never a raw
 * error region.
 *
 * FETCH DEDUP: a dashboard that mounts many system-source tiles against the SAME
 * endpoint (e.g. the admin overview's 7 KPIs all reading `/api/admin/overview`)
 * must NOT issue one heavy roll-up fetch per tile. The `useQuery` `queryKey` is
 * keyed on ONLY the endpoint + static `query` (NOT the per-tile `valuePath` /
 * `valueTemplate`), so TanStack Query collapses every tile sharing that endpoint
 * into ONE in-flight request + ONE cache entry. Each tile then derives its own
 * scalar/template value from the shared cached envelope via the query `select`,
 * with NO extra fetch.
 */

/** Neutral em-dash placeholder rendered when a system value can't be resolved. */
export const KPI_NEUTRAL_VALUE = '—'

/**
 * The resolved system value:
 * - `{ kind: 'value' }` — a numeric scalar read at `valuePath` (goes through `kpiFormat`)
 * - `{ kind: 'template' }` — a composite string from `valueTemplate` (rendered verbatim)
 * - `{ kind: 'neutral' }` — missing path / failed fetch (renders the neutral placeholder)
 */
export type KpiSystemValue =
  | { readonly kind: 'value'; readonly value: number }
  | { readonly kind: 'template'; readonly value: string }
  | { readonly kind: 'neutral' }

/** Reads a dotted path (e.g. `records.total`) from a JSON envelope. */
function readDottedPath(envelope: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc === null || acc === undefined || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[segment]
  }, envelope)
}

/**
 * Resolves the rendered system value from a fetched envelope:
 * - `valueTemplate` interpolates `{dotted.path}` tokens (a token that doesn't
 *   resolve to a scalar collapses the whole value to neutral);
 * - `valuePath` reads one scalar and coerces it to a finite number (a missing or
 *   non-coercible scalar is neutral).
 */
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

/**
 * Fetches the system endpoint and resolves the KPI's scalar / template value.
 *
 * Dedup: the query is the page's ONE entry for this endpoint + static `query`
 * (`systemEnvelopeQueryKey`, NOT keyed on the per-tile `valuePath` /
 * `valueTemplate`), so every tile — and every chart — reading the same
 * endpoint collapses into ONE fetch + ONE cache entry. The `queryFn` returns
 * the RAW envelope; the `select` derives THIS tile's value from it.
 *
 * Resilience: an AUTH DENIAL (401/403/404 — the anonymous-visitor / anti-enum
 * case, mirroring `useKpiRecords`) is cached as a `denied` result that
 * `select` maps to a NEUTRAL value, and is NOT retried. Any OTHER non-2xx
 * (e.g. a transient 5xx under load) or network error THROWS so TanStack Query
 * retries it before the island degrades, so a single transient hiccup doesn't
 * cache a stale neutral. The island treats an exhausted-retry error (`data`
 * undefined) as neutral too, so the card always degrades calmly rather than
 * surfacing a raw error region.
 *
 * A sibling's `onSuccess.refetch` naming this tile's host re-reads the
 * envelope; a system binding has no table, so it never polls or subscribes.
 */
export function useKpiSystemValue(system: KpiSystemSource | undefined) {
  const query = useQuery({
    queryKey: systemEnvelopeQueryKey(system),
    enabled: Boolean(system?.endpoint),
    queryFn: () => fetchSystemEnvelope(system),
    // Per-tile derivation off the SHARED cached envelope — no extra fetch. The
    // resolve logic (valueTemplate interpolation, valuePath scalar coercion,
    // missing/denied → neutral) is byte-identical to the pre-dedup behavior.
    select: (result: SystemEnvelopeResult): KpiSystemValue =>
      result.kind === 'denied' || !system
        ? { kind: 'neutral' }
        : resolveSystemValue(system, result.envelope),
  })
  useLiveRefresh(system === undefined ? undefined : {}, query.refetch)
  return query
}
