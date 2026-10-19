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
import { dispatch } from '@/presentation/islands/runtime/event-bus'
import { openingPlace } from './record-drawer-opening-list'
import type { DrawerBuiltInLabels } from './record-drawer-labels'
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

/** The English words, which a page in another language receives resolved from the host. */
const ENGLISH_WORDS = {
  previous: 'Previous',
  next: 'Next',
  fullPage: 'Open full page',
  navigation: 'Record navigation',
}

const STEP_CLASS =
  'border-border text-foreground hover:bg-muted rounded-md border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50'

/** The record's own page, its `$record.*` filled, once the record has loaded. */
const fullPageHref = (fullPage: string | undefined, record: RawRecord): string | undefined =>
  fullPage === undefined || record['id'] === undefined
    ? undefined
    : toSafeRedirectPath(substituteRecordVars(fullPage, withDisplayLabels(record)))

export function DrawerNavigation({
  id,
  navigation,
  record,
  recordId,
  labels,
}: {
  readonly id: string | undefined
  readonly navigation: NonNullable<DrawerNavigationProps['navigation']>
  readonly record: RawRecord
  readonly recordId: string | undefined
  /** The page-language words; English when the host gave none. */
  readonly labels?: DrawerBuiltInLabels | undefined
}): ReactElement {
  const words = { ...ENGLISH_WORDS, ...labels }
  const { siblings, index, offset, total } = openingPlace(id, recordId)
  const stepTo = (next: string | undefined): void => {
    if (id && next !== undefined)
      dispatch('sovrium:open-drawer', { id, record: { id: next }, siblings, offset, total })
  }
  const href = fullPageHref(navigation.fullPage, record)
  return (
    <nav
      aria-label={words.navigation}
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
            {words.previous}
          </button>
          <button
            type="button"
            className={STEP_CLASS}
            disabled={index === siblings.length - 1}
            onClick={() => stepTo(siblings[index + 1])}
          >
            {words.next}
          </button>
        </>
      )}
      {href !== undefined && (
        <a
          href={href}
          className="text-foreground ml-auto text-sm font-medium underline underline-offset-2"
        >
          {words.fullPage}
        </a>
      )}
    </nav>
  )
}
