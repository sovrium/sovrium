/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import { buildSystemQueryUrl } from '../runtime/system-query-url'
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

/** Status codes that mean "the read is denied", not "transient failure". */
const AUTH_DENIAL_STATUSES = new Set([401, 403, 404])

/**
 * The SHARED query result cached per endpoint (the dedup unit). Either the parsed
 * JSON `envelope` (the per-tile `select` reads its own scalar/template out of it)
 * or `denied` — the auth-denial case, cached as a calm sentinel rather than a
 * throw so it is NOT retried (anonymous visitor / admin-gated endpoint).
 */
type EnvelopeResult =
  { readonly kind: 'envelope'; readonly envelope: unknown } | { readonly kind: 'denied' }

/**
 * Fetches the system endpoint and resolves the KPI's scalar / template value.
 *
 * Dedup: the `useQuery` `queryKey` is keyed on ONLY the endpoint + static `query`
 * (NOT the per-tile `valuePath` / `valueTemplate`), so every system-source tile
 * sharing an endpoint collapses into ONE fetch + ONE cache entry. The `queryFn`
 * returns the RAW envelope; the `select` derives THIS tile's value from the
 * shared cache without an extra fetch.
 *
 * Resilience (IDENTICAL to before): an AUTH DENIAL (401/403/404 — the
 * anonymous-visitor / anti-enum case, mirroring `useKpiRecords`) caches a
 * `denied` sentinel that `select` maps to a NEUTRAL value, and is NOT retried.
 * Any OTHER non-2xx (e.g. a transient 5xx under load) or network error THROWS so
 * TanStack Query retries it before the island degrades, so a single transient
 * hiccup doesn't cache a stale neutral. The island treats an exhausted-retry
 * error (`data` undefined) as neutral too, so the card always degrades calmly
 * rather than surfacing a raw error region.
 */
export function useKpiSystemValue(system: KpiSystemSource | undefined) {
  return useQuery({
    // Keyed on endpoint + static query ONLY (not valuePath/valueTemplate) so all
    // tiles on the same endpoint dedupe to a single shared fetch + cache entry.
    queryKey: ['kpi-system-value', system?.endpoint, system?.query],
    enabled: Boolean(system?.endpoint),
    queryFn: async (): Promise<EnvelopeResult> => {
      if (!system?.endpoint) return { kind: 'denied' }
      const res = await fetch(buildSystemQueryUrl(system), { credentials: 'include' })
      // Denied read → cached sentinel → neutral, no retry (anonymous visitor /
      // admin-gated endpoint).
      if (AUTH_DENIAL_STATUSES.has(res.status)) return { kind: 'denied' }
      if (!res.ok) {
        // Transient failure — throw so TanStack Query retries before degrading.
        // eslint-disable-next-line functional/no-throw-statements -- TanStack Query expects thrown errors to drive retries
        throw new Error(`KPI system endpoint failed: ${String(res.status)}`)
      }
      const envelope = (await res.json()) as unknown
      return { kind: 'envelope', envelope }
    },
    // Per-tile derivation off the SHARED cached envelope — no extra fetch. The
    // resolve logic (valueTemplate interpolation, valuePath scalar coercion,
    // missing/denied → neutral) is byte-identical to the pre-dedup behavior.
    select: (result: EnvelopeResult): KpiSystemValue =>
      result.kind === 'denied' || !system
        ? { kind: 'neutral' }
        : resolveSystemValue(system, result.envelope),
  })
}
