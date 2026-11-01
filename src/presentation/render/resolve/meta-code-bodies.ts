/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Page } from '@/domain/models/app/pages'

/**
 * The code a page's `meta` declares: an analytics provider's `initScript` and
 * a `customElements` entry's `content`, the body of a script or a style.
 *
 * Both reach the document VERBATIM (operator-authored code, rendered as
 * written), so a page reference in them is never filled: a value a visitor or
 * a record supplies would otherwise become code. Every other `meta` leaf — the
 * title, the description, the social card, the canonical link, the structured
 * data — is text or is serialised safely, and keeps its references.
 *
 * `withAuthoredMetaCode(authored, substituted)` is the one rule every pass that
 * deep-walks `meta` applies after it substitutes: it puts the authored code
 * bodies back over whatever the walk made of them.
 */

type Meta = NonNullable<Page['meta']>

interface MetaCode {
  readonly analytics?: { readonly providers?: readonly unknown[] }
  readonly customElements?: readonly unknown[]
}

/** `substituted[i]` with `authored[i]`'s own `key` back in place, entry by entry. */
const restoreKey = (
  authored: readonly unknown[] | undefined,
  substituted: readonly unknown[] | undefined,
  key: string
): readonly unknown[] | undefined =>
  substituted?.map((entry, index) => {
    const original = authored?.[index]
    if (typeof original !== 'object' || original === null || !(key in original)) return entry
    if (typeof entry !== 'object' || entry === null) return entry
    return { ...entry, [key]: (original as Readonly<Record<string, unknown>>)[key] }
  })

/**
 * `substituted` (the result of a pass over `authored`) with every analytics
 * `initScript` and every `customElements` `content` exactly as `authored`
 * wrote it.
 */
export function withAuthoredMetaCode<M extends Page['meta']>(authored: M, substituted: M): M {
  if (authored === undefined || substituted === undefined) return substituted
  const before = authored as Meta & MetaCode
  const after = substituted as Meta & MetaCode
  const providers = restoreKey(
    before.analytics?.providers,
    after.analytics?.providers,
    'initScript'
  )
  const customElements = restoreKey(before.customElements, after.customElements, 'content')
  return {
    ...after,
    ...(after.analytics !== undefined && providers !== undefined
      ? { analytics: { ...after.analytics, providers } }
      : {}),
    ...(customElements !== undefined ? { customElements } : {}),
  } as M
}
