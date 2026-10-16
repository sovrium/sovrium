/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A generic record sheet's tabs: Details first, then whichever of Activity,
 * Comments and Access its reader is offered (decided by the server — see
 * `resolve-record-drawer-generic.ts`).
 *
 * The open tab is named in the address right after the record —
 * `?record=<id>&tab=activity` — so a copied address reopens the sheet on the
 * same tab, and an address naming a tab opens on it. Details is the tab a sheet
 * opens on, so it is never written.
 *
 * Only the open tab's panel is drawn: Activity reads the record's history and
 * Comments its thread, and neither is read until the reader turns to it.
 */

import { useCallback, useId, useState, type KeyboardEvent, type ReactElement } from 'react'
import { addressedTab, writeDrawerTab } from './record-drawer-address'

/** One tab: the slug the address names it by, its label, and its panel. */
export interface SheetTab {
  readonly slug: string
  readonly label: string
  readonly panel: () => ReactElement
}

const TABLIST_CLASS = 'border-border flex gap-4 border-b'
const TAB_CLASS =
  'text-muted-foreground hover:text-foreground -mb-px border-b-2 border-transparent px-1 pb-2 text-sm font-medium aria-selected:border-primary aria-selected:text-foreground'

/** The tab the sheet opens on: the one the address names, when it is offered, else the first. */
const initialTab = (tabs: readonly SheetTab[]): string => {
  const named = addressedTab()
  return tabs.find((tab) => tab.slug === named)?.slug ?? tabs[0]?.slug ?? ''
}

/** Move the selection with the arrow keys, as a tablist does. */
const stepSelection = (
  tabs: readonly SheetTab[],
  current: string,
  key: string
): string | undefined => {
  const at = tabs.findIndex((tab) => tab.slug === current)
  if (key === 'ArrowRight') return tabs[(at + 1) % tabs.length]?.slug
  if (key === 'ArrowLeft') return tabs[(at - 1 + tabs.length) % tabs.length]?.slug
  return undefined
}

/** The sheet's tabs and the open tab's panel. */
export function SheetTabs({ tabs }: { readonly tabs: readonly SheetTab[] }): ReactElement {
  const [selected, setSelected] = useState(() => initialTab(tabs))
  const baseId = useId()
  const select = useCallback(
    (slug: string) => {
      setSelected(slug)
      writeDrawerTab(slug === tabs[0]?.slug ? undefined : slug)
    },
    [tabs]
  )
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const next = stepSelection(tabs, selected, event.key)
    if (next !== undefined) select(next)
  }
  const open = tabs.find((tab) => tab.slug === selected) ?? tabs[0]
  return (
    <>
      <div
        role="tablist"
        className={TABLIST_CLASS}
        onKeyDown={onKeyDown}
      >
        {tabs.map((tab) => (
          <button
            key={tab.slug}
            type="button"
            role="tab"
            id={`${baseId}-${tab.slug}-tab`}
            aria-controls={`${baseId}-${tab.slug}-panel`}
            aria-selected={tab.slug === open?.slug}
            tabIndex={tab.slug === open?.slug ? 0 : -1}
            onClick={() => select(tab.slug)}
            className={TAB_CLASS}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {open !== undefined && (
        <div
          role="tabpanel"
          id={`${baseId}-${open.slug}-panel`}
          aria-labelledby={`${baseId}-${open.slug}-tab`}
          className="flex flex-col gap-4"
        >
          {open.panel()}
        </div>
      )}
    </>
  )
}
