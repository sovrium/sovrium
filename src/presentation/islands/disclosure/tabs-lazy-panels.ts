/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Fetch-on-activation for a tab set whose panels are an ADDRESS
 *.
 *
 * The server stops serialising the unopened panels of a tab set whose
 * `defaultTab` binds to a declared `page.query` property — see
 * `render/resolve/tabs-lazy-resolver.ts` for why that condition, and only that
 * condition, makes the deferral affordable. What is left is the other half:
 * opening one has to produce it.
 *
 * ## Why the PAGE, and not a panel endpoint
 *
 * The same answer `refetch-server-rendered-region.ts` gives, for the same
 * reason: re-asking the current page with one query parameter changed re-runs
 * the WHOLE server render — `$record.` substitution, per-row `visibility`
 * gating, permission filtering, translation — and hands back exactly the markup
 * a first load at that address would have produced. A panel endpoint would mean
 * a second renderer in the browser, free to drift from the server's, and a
 * permission gate that fired on one and not the other.
 *
 * Two properties make it faithful rather than clever, and both are inherited:
 *
 *  - the address is a DECLARED query property, so `buildPageCacheKey` already
 *    varies on it (`pageQueryVariantKey`) and a cached answer is the answer for
 *    this panel rather than for another one;
 *  - the read carries the caller's own cookies, so the panel is the panel this
 *    visitor could have seen (S1).
 *
 * ## Failure is a NAVIGATION, not an error message
 *
 * When the fetch fails, or comes back without the panel, the reader is sent to
 * the address itself. The tab was always a real link — the SSR strip emits
 * `<a href="?tab=…">` for exactly this tab set — so the fallback is the
 * unenhanced path the page already had, and the reader ends up on the lens they
 * asked for rather than on a panel apologising.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { hydrateSessionBindings } from '@/presentation/islands/runtime/session-resolver'

/**
 * The current URL with one query parameter set to a panel id, as a
 * SAME-ORIGIN PATH.
 *
 * A path rather than an absolute URL because one of the three uses is a
 * navigation sink: `toSafeRedirectPath` is the single canonical check
 * (`sovrium/no-unguarded-navigation`) and it is written for paths. The other
 * two — `fetch` and `pushState` — are equally happy with one, and the page's
 * other query parameters survive because this EDITS the live URL rather than
 * replacing its query wholesale.
 */
function panelAddress(param: string, id: string): string {
  const url = new URL(window.location.href)
  url.searchParams.set(param, id)
  return `${url.pathname}${url.search}`
}

/**
 * Re-render the page at a panel's address and return THAT panel's markup.
 *
 * `DOMParser` builds an inert document: a `<script>` it parses is never
 * executed, and nothing here adopts a node out of it into the live tree.
 *
 * SECURITY (standing rule S2): the bytes returned are this page's own server
 * render, produced moments ago for this request and this session — the same
 * markup a first load at this address would have put in the document, taking a
 * shorter route into it. Record values inside were escaped by the server's own
 * render exactly as on first load, so no second sanitiser is introduced. This
 * is the rule `island-client.tsx`'s `ssrHtml` capture and `swapRegion` both
 * already follow.
 *
 * The panel is matched by `data-tab-panel-id` alone. Two tab sets on one page
 * sharing both an address parameter and a panel id would be in lockstep by
 * construction — they read the same value — so the first match is the right one.
 */
async function fetchPanelMarkup(param: string, id: string): Promise<string | undefined> {
  try {
    const response = await fetch(panelAddress(param, id), {
      credentials: 'include',
      headers: { Accept: 'text/html' },
    })
    if (!response.ok) return undefined
    const parsed = new DOMParser().parseFromString(await response.text(), 'text/html')
    const panel = parsed.querySelector(`[data-tab-panel-id="${CSS.escape(id)}"]`)
    return panel?.innerHTML
  } catch {
    return undefined
  }
}

/** The panel id the live URL names, when it names one this tab set knows. */
function addressedPanel(param: string, known: readonly string[]): string | undefined {
  const named = new URL(window.location.href).searchParams.get(param) ?? undefined
  return named !== undefined && known.includes(named) ? named : undefined
}

export interface LazyTabPanels {
  /** The open panel. Only meaningful for an addressed tab set, which is controlled. */
  readonly active: string | undefined
  /** Markup fetched so far, by panel id. A panel is fetched at most once. */
  readonly fetched: Readonly<Record<string, string>>
  /**
   * What `Tabs.Root` should call when a tab is activated: open the panel,
   * reflect it in the URL, fetch it the first time — and re-scan for nested
   * island markers, which Base UI mounts only when their panel is selected.
   */
  readonly onValueChange: (value: unknown) => void
}

/**
 * Track the open panel, keep it in the URL, and fetch it the first time.
 *
 * Returns inert values when `lazyParam` is absent, which is every tab set the
 * author did not make an address: `activate` does nothing, `fetched` stays
 * empty, and the island leaves `Tabs.Root` UNCONTROLLED. Switching there is
 * still instant and still offline-safe — not one byte of behaviour moves.
 *
 * `pushState` rather than a navigation, and `popstate` read back, so Back
 * returns to the lens the reader came from instead of leaving the page. A panel
 * the reader returns to is already in `fetched` and costs nothing.
 */
export function useLazyTabPanels(input: {
  readonly lazyParam: string | undefined
  readonly initial: string | undefined
  readonly panelIds: readonly string[]
  /** Panel ids whose markup the page already carries — never worth asking for. */
  readonly resolvedIds: readonly string[]
  readonly rootRef: RefObject<HTMLDivElement | null>
  readonly onPanelReady: () => void
}): LazyTabPanels {
  const { lazyParam, initial, panelIds, resolvedIds, rootRef, onPanelReady } = input
  const [active, setActive] = useState<string | undefined>(initial)
  const [fetched, setFetched] = useState<Readonly<Record<string, string>>>({})
  const load = usePanelLoader(lazyParam, resolvedIds, setFetched)

  const onValueChange = useCallback(
    (value: unknown) => {
      onPanelReady()
      if (lazyParam === undefined) return
      const id = String(value)
      setActive(id)
      if (addressedPanel(lazyParam, panelIds) !== id) {
        window.history.pushState(undefined, '', panelAddress(lazyParam, id))
      }
      load(id)
    },
    [lazyParam, panelIds, load, onPanelReady]
  )

  useHistoryAddress({ lazyParam, initial, panelIds, setActive, load })
  useInjectedPanels(fetched, rootRef, onPanelReady)

  return { active, fetched, onValueChange }
}

/**
 * Ask for a panel once, ever — and never for one the page already has.
 *
 * The ref holds the ids whose fetch has been STARTED, which is what makes
 * "fetched at most once" true while one is still in flight — `fetched` alone
 * would let a second activation during the round trip issue a second request.
 *
 * `resolvedIds` is the other half: the panel the URL addressed is already in
 * the document, so returning to it after opening another one must cost nothing.
 * Without this the cheapest gesture on the page — go and come back — would be
 * the one that spends a round trip.
 */
function usePanelLoader(
  lazyParam: string | undefined,
  resolvedIds: readonly string[],
  setFetched: (
    update: (previous: Readonly<Record<string, string>>) => Record<string, string>
  ) => void
): (id: string) => void {
  const requested = useRef<readonly string[]>([])
  return useCallback(
    (id: string) => {
      if (lazyParam === undefined || resolvedIds.includes(id)) return
      if (requested.current.includes(id)) return
      // eslint-disable-next-line functional/immutable-data -- Ref records an in-flight fetch so a second activation does not re-issue it
      requested.current = [...requested.current, id]
      void fetchPanelMarkup(lazyParam, id).then((html) => {
        if (html === undefined) {
          const target = toSafeRedirectPath(panelAddress(lazyParam, id))
          if (target !== undefined) window.location.assign(target)
          return
        }
        setFetched((previous) => ({ ...previous, [id]: html }))
      })
    },
    [lazyParam, resolvedIds, setFetched]
  )
}

/** Back and Forward: the address IS the open tab, so a history entry names one. */
function useHistoryAddress(input: {
  readonly lazyParam: string | undefined
  readonly initial: string | undefined
  readonly panelIds: readonly string[]
  readonly setActive: (id: string) => void
  readonly load: (id: string) => void
}): void {
  const { lazyParam, initial, panelIds, setActive, load } = input
  useEffect(() => {
    if (lazyParam === undefined) return undefined
    const onPop = (): void => {
      // A history entry that names no panel of THIS tab set — the reader went
      // back past the page, or a sibling pushed an unrelated address — returns
      // it to the one the server opened. That one is in the document already,
      // so `load` is not called for it: an unrelated Back must not spend a
      // round trip on a panel nobody is waiting for.
      const named = addressedPanel(lazyParam, panelIds)
      if (named === undefined) {
        if (initial !== undefined) setActive(initial)
        return
      }
      setActive(named)
      load(named)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [lazyParam, panelIds, initial, setActive, load])
}

/**
 * Bring a just-injected panel to life.
 *
 * Its markup is bytes the first-load passes never saw: `$session.` markers
 * unresolved, nested `data-island` markers unmounted. Both are re-applied here,
 * as `swapRegion` does for a refetched region, and both are no-ops on a panel
 * carrying neither.
 */
function useInjectedPanels(
  fetched: Readonly<Record<string, string>>,
  rootRef: RefObject<HTMLDivElement | null>,
  onPanelReady: () => void
): void {
  useEffect(() => {
    if (Object.keys(fetched).length === 0) return
    const root = rootRef.current
    if (root) hydrateSessionBindings(root)
    onPanelReady()
  }, [fetched, rootRef, onPanelReady])
}
