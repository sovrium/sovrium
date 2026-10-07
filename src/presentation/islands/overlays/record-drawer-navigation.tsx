/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `drawer.navigation` — Previous / Next through the list that opened the
 * drawer, and a link to the record's own page.
 *
 * THE LIST IS THE OPENER'S, NOT THE TABLE'S. A grid filtered to open orders
 * and sorted by reference hands the drawer the ids it shows, in that order,
 * with the row it opens (`sovrium:open-drawer` `detail.siblings`). Stepping
 * re-dispatches the same event for the neighbour, so the drawer's own open
 * path — fetch, address, title — is the one a click already takes, and the
 * address follows each step.
 *
 * A drawer reached by its address alone (`?record=`) knows no list: it draws
 * the full-page link and no steps.
 */

import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import {
  substituteRecordVars,
  withDisplayLabels,
} from '@/domain/models/app/pages/substitute-record-vars'
import { dispatch, subscribe } from '@/presentation/islands/runtime/event-bus'
import type { RawRecord } from './record-drawer-record-read'
import type { ReactElement } from 'react'

/** The drawer's `navigation` option as the server forwards it. */
export interface DrawerNavigationProps {
  readonly navigation?: {
    /** Step through the opening list's rows. */
    readonly siblings?: boolean
    /** The record's own page, with `$record.<field>` tokens (`/orders/$record.id`). */
    readonly fullPage?: string
  }
}

const STEP_CLASS =
  'border-border text-foreground hover:bg-background-subtle rounded-md border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50'

/**
 * The ids of the list that last opened each drawer, by drawer id. Recorded by a
 * listener registered when this module loads — before any row is clicked — so
 * the FIRST open is captured too: the navigation is not on screen to hear it,
 * because the drawer only draws it once it has opened.
 */
const OPENING_LISTS = new Map<string, readonly string[]>()
subscribe('sovrium:open-drawer', (detail) => {
  OPENING_LISTS.set(detail.id, detail.siblings ?? [])
})

export function DrawerNavigation({
  id,
  navigation,
  record,
  recordId,
}: {
  readonly id: string | undefined
  readonly navigation: NonNullable<DrawerNavigationProps['navigation']>
  readonly record: RawRecord
  readonly recordId: string | undefined
}): ReactElement {
  const siblings = (id === undefined ? undefined : OPENING_LISTS.get(id)) ?? []
  const index = recordId === undefined ? -1 : siblings.indexOf(recordId)
  const stepTo = (next: string | undefined): void => {
    if (id && next !== undefined)
      dispatch('sovrium:open-drawer', { id, record: { id: next }, siblings })
  }
  const href =
    navigation.fullPage === undefined || record['id'] === undefined
      ? undefined
      : toSafeRedirectPath(substituteRecordVars(navigation.fullPage, withDisplayLabels(record)))
  return (
    <nav
      aria-label="Record navigation"
      className="flex items-center gap-2"
    >
      {navigation.siblings === true && index !== -1 && (
        <>
          <button
            type="button"
            className={STEP_CLASS}
            disabled={index === 0}
            onClick={() => stepTo(siblings[index - 1])}
          >
            Previous
          </button>
          <button
            type="button"
            className={STEP_CLASS}
            disabled={index === siblings.length - 1}
            onClick={() => stepTo(siblings[index + 1])}
          >
            Next
          </button>
        </>
      )}
      {href !== undefined && (
        <a
          href={href}
          className="text-foreground ml-auto text-sm font-medium underline underline-offset-2"
        >
          Open full page
        </a>
      )}
    </nav>
  )
}
