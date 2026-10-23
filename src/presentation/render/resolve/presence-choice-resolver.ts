/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { seesPresence } from '@/domain/models/app/auth/presence-audience-service'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'

/**
 * A filter bar's Online / Offline choice (`online`), kept only for a reader
 * shown presence (`auth.presence.visibleTo`).
 *
 * Presence is not drawn for anyone else, and the directory answers them a
 * condition on `online` with no one; offering the choice anyway would be a
 * control that always empties the list. So the key is dropped from every
 * filter bar of the page before it is drawn — the island never learns there
 * was a choice to make.
 *
 * Pure, and a page with no such choice, or a reader who sees presence, is
 * returned by reference.
 */
export function gatePresenceChoices(
  page: Page,
  app: Pick<App, 'auth'>,
  session: SessionInfo | undefined
): Page {
  if (!holdsChoice(page.components) && !holdsChoice(page.layout)) return page
  if (seesPresence(app, { role: session?.role, signedIn: session !== undefined })) return page
  return {
    ...page,
    ...(page.components === undefined
      ? {}
      : { components: dropChoices(page.components) as Page['components'] }),
    ...(page.layout === undefined ? {} : { layout: dropChoices(page.layout) as Page['layout'] }),
  }
}

/** Whether a filter bar with an `online` choice sits anywhere under `value`. */
function holdsChoice(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(holdsChoice)
  if (!isRecord(value)) return false
  if (value['type'] === 'filter-bar' && value['online'] !== undefined) return true
  return Object.values(value).some(holdsChoice)
}

/** `value` with the `online` key of every filter bar under it removed. */
function dropChoices(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(dropChoices)
  if (!isRecord(value)) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !(value['type'] === 'filter-bar' && key === 'online'))
      .map(([key, child]) => [key, dropChoices(child)])
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
