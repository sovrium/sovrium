/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildSystemQueryUrl } from './system-query-url'

/**
 * ONE cache entry per system read on a page, whoever reads it.
 *
 * A KPI tile and a chart bound to the same endpoint and static query ask the
 * server the same question: the analytics overview's three headline figures
 * and its time series come from one `/api/analytics/overview` envelope, and a
 * form's Insights figures and its per-day series from one aggregate read. They
 * used to be cached under two keys — `kpi-system-value` and
 * `chart-system-records`, the latter also keyed on `rowsKey` — so every
 * dashboard pairing a figure with its trend fetched the envelope twice.
 *
 * The entry holds the RAW envelope, keyed on the endpoint and the static query
 * only; each reader derives its own value with a `select`. The shared page
 * QueryClient's `staleTime` is what lets the reader that mounts second — the
 * chart, whose chunk is the heavier one — find the envelope already there.
 */

/** The static request every system-source binding shapes: an endpoint and its query. */
interface SystemEnvelopeSource {
  readonly endpoint: string
  readonly query?: Readonly<Record<string, string | number | boolean>> | undefined
}

/**
 * A read's cached outcome. A refusal (401 / 403 / 404 — signed out, not
 * allowed, or the anti-enumeration answer) is DATA rather than a throw: asking
 * again returns it again, so it is not retried, and each reader decides what a
 * refusal means for it. The body is kept for the reader that shows it.
 */
export type SystemEnvelopeResult =
  | { readonly kind: 'envelope'; readonly envelope: unknown }
  | { readonly kind: 'denied'; readonly status: number; readonly body: string }

const REFUSED_STATUSES: ReadonlySet<number> = new Set([401, 403, 404])

/** A failed read that is not a refusal; thrown, so the query retries it. */
export class SystemEnvelopeReadError extends Error {
  constructor(
    readonly status: number,
    readonly body: string
  ) {
    super(`${String(status)} ${body}`)
    this.name = 'SystemEnvelopeReadError'
  }
}

/** The cache key every reader of one system read shares. */
export const systemEnvelopeQueryKey = (
  system: SystemEnvelopeSource | undefined
): readonly unknown[] => ['system-envelope', system?.endpoint, system?.query]

/** Read the envelope, credentialed: system reads are session-gated. */
export async function fetchSystemEnvelope(
  system: SystemEnvelopeSource | undefined
): Promise<SystemEnvelopeResult> {
  if (!system?.endpoint) return { kind: 'denied', status: 0, body: '' }
  const res = await fetch(buildSystemQueryUrl(system), { credentials: 'include' })
  if (REFUSED_STATUSES.has(res.status))
    return { kind: 'denied', status: res.status, body: await res.text() }
  if (!res.ok) throw new SystemEnvelopeReadError(res.status, await res.text())
  return { kind: 'envelope', envelope: (await res.json()) as unknown }
}
