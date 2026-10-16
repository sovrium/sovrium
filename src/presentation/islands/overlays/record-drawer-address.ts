/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A record drawer's place in the address: `?record=<id>&drawer=<drawer id>`.
 *
 * Every drawer that opens on a record writes both, so the address a reader
 * copies reopens THAT drawer on THAT record — on a page declaring several
 * record drawers, a bare `?record=` cannot say which. Reading it back:
 *
 *  - `drawer` present: only the drawer of that id opens;
 *  - `drawer` absent (a link written before the parameter existed, or typed by
 *    hand): only the FIRST record-bound drawer the page declares opens, in
 *    document order, never every one of them on an id that belongs to one.
 *
 * The address is replaced, not pushed: opening a drawer is not a navigation,
 * and Back should leave the page rather than walk through every record read.
 * Built with `URLSearchParams`, so every other parameter survives untouched.
 */

const RECORD_PARAM = 'record'
const DRAWER_PARAM = 'drawer'
const TAB_PARAM = 'tab'

/** The `record` a sheet opened to create one carries: `?record=new`. */
export const NEW_RECORD_ADDRESS = 'new'

/** Replace the current address's query with `params`, keeping path and hash. */
function replaceQuery(params: URLSearchParams): void {
  const query = params.toString()
  const { pathname, hash } = window.location
  window.history.replaceState(
    window.history.state,
    '',
    `${pathname}${query ? `?${query}` : ''}${hash}`
  )
}

/**
 * Name `drawerId` and `recordId` in the address. A tab named for ANOTHER record
 * is dropped, since the record the address now names opens on its details; the
 * same record keeps the tab it was reached on.
 */
export function writeDrawerAddress(drawerId: string, recordId: string): void {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  if (params.get(RECORD_PARAM) !== recordId) params.delete(TAB_PARAM)
  params.set(RECORD_PARAM, recordId)
  params.set(DRAWER_PARAM, drawerId)
  replaceQuery(params)
}

/**
 * Name the sheet's open tab in the address, right after the record —
 * `?record=<id>&tab=<tab>` — or take it out for the details tab, which a sheet
 * opens on anyway.
 */
export function writeDrawerTab(tab: string | undefined): void {
  if (typeof window === 'undefined') return
  const entries = [...new URLSearchParams(window.location.search)].filter(
    ([name]) => name !== TAB_PARAM
  )
  const at = entries.findIndex(([name]) => name === RECORD_PARAM)
  const withTab =
    tab === undefined || at === -1
      ? entries
      : [
          ...entries.slice(0, at + 1),
          [TAB_PARAM, tab] as [string, string],
          ...entries.slice(at + 1),
        ]
  replaceQuery(new URLSearchParams(withTab))
}

/** The tab the address names, or `undefined` when it names none. */
export const addressedTab = (): string | undefined =>
  typeof window === 'undefined'
    ? undefined
    : (new URLSearchParams(window.location.search).get(TAB_PARAM) ?? undefined)

/**
 * Take the drawer out of the address when it closes — only when the address
 * names THIS drawer, so a closing drawer never erases another one's link.
 */
export function clearDrawerAddress(drawerId: string): void {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  if (params.get(DRAWER_PARAM) !== drawerId) return
  replaceQuery(
    new URLSearchParams(
      [...params].filter(
        ([name]) => name !== RECORD_PARAM && name !== DRAWER_PARAM && name !== TAB_PARAM
      )
    )
  )
}

interface HostProps {
  readonly id?: unknown
  readonly table?: unknown
  readonly system?: unknown
  readonly deepLink?: unknown
}

/** The props a record-drawer host serialised, or `undefined` when unreadable. */
function hostProps(host: Element): HostProps | undefined {
  try {
    const parsed: unknown = JSON.parse(host.getAttribute('data-island-props') ?? '')
    return typeof parsed === 'object' && parsed !== null ? (parsed as HostProps) : undefined
  } catch {
    return undefined
  }
}

/** The id of the first record-bound drawer the page declares that a link may open. */
function firstDeepLinkDrawerId(): unknown {
  const hosts = Array.from(document.querySelectorAll('[data-island="record-drawer"]'))
  return hosts
    .map(hostProps)
    .find(
      (props) =>
        props !== undefined &&
        (props.table !== undefined || props.system !== undefined) &&
        props.deepLink !== false
    )?.id
}

/**
 * The record the address asks THIS drawer to open, or `undefined` when it
 * names none, names another drawer, or (bare `?record=`) this is not the
 * page's first record-bound drawer.
 *
 * `deepLink: false` marks a drawer reached only from another drawer's related
 * rows: a bare `?record=` never opens it — the id belongs to the page's own
 * table — but an address that NAMES it does, since that address was written
 * when it opened.
 */
export function addressedRecordId(
  drawerId: string | undefined,
  deepLink: boolean
): string | undefined {
  const params = new URLSearchParams(window.location.search)
  const recordId = params.get(RECORD_PARAM)
  if (!recordId) return undefined
  const named = params.get(DRAWER_PARAM)
  if (named !== null) return named === drawerId ? recordId : undefined
  if (!deepLink) return undefined
  if (drawerId === undefined) return recordId
  return firstDeepLinkDrawerId() === drawerId ? recordId : undefined
}
