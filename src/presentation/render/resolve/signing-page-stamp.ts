/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Tell each `signature-pad` of a page which page it is drawn on.
 *
 * A signature names the page its pad was shown on, so the server resolves the
 * statement from that page's own declaration rather than from text the
 * browser sends. The pad renderer reads the name from `props._signingPage`.
 * Only the nodes on the way to a pad are rebuilt; a page with no pad is handed
 * back as it is.
 */

const PAGE_PROP = '_signingPage'

const containsPad = (node: unknown): boolean => {
  if (Array.isArray(node)) return node.some(containsPad)
  if (node === null || typeof node !== 'object') return false
  const record = node as Readonly<Record<string, unknown>>
  return record['type'] === 'signature-pad' || Object.values(record).some(containsPad)
}

const stamp = (node: unknown, page: string): unknown => {
  if (!containsPad(node)) return node
  if (Array.isArray(node)) return node.map((item: unknown) => stamp(item, page))
  const record = node as Readonly<Record<string, unknown>>
  const walked = Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, stamp(value, page)])
  )
  if (record['type'] !== 'signature-pad') return walked
  const props = (record['props'] ?? {}) as Readonly<Record<string, unknown>>
  return { ...walked, props: { ...props, [PAGE_PROP]: page } }
}

/** The sections, each `signature-pad` among them naming `pageName` as its page. */
export const withSigningPage = <T>(sections: readonly T[], pageName: string | undefined) =>
  pageName === undefined ? sections : (stamp(sections, pageName) as readonly T[])

/** The page a pad was stamped with, from its raw props. */
export const signingPageOf = (rawProps: Readonly<Record<string, unknown>> | undefined) => {
  const page = rawProps?.[PAGE_PROP]
  return typeof page === 'string' ? page : ''
}
