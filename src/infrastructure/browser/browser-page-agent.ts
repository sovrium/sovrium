/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { evaluate, findOne } from './browser-page-find'
import { outlineCall } from './browser-page-outline-runtime'
import type { PageState } from './browser-page-state'
import type {
  BrowserElementKind,
  BrowserLocator,
} from '@/application/ports/services/browser-driver'

/**
 * What a model is shown of a page, and the check the driver makes before it
 * acts on a model's choice: which kind of element a locator names. Whether a
 * gesture sends data is decided at the network (`browser-page-gate.ts`).
 */

const TEXT_TYPES: ReadonlySet<string> = new Set([
  '',
  'text',
  'email',
  'tel',
  'url',
  'search',
  'number',
  'password',
  'date',
  'datetime-local',
  'month',
  'week',
  'time',
])

/** The kind a resolved element is, from its tag and type. */
export const kindOfElement = (
  tag: string | undefined,
  type: string | undefined
): BrowserElementKind => {
  const t = (type ?? '').toLowerCase()
  if (tag === 'TEXTAREA') return 'field'
  if (tag === 'SELECT') return 'list'
  if (tag !== 'INPUT') return 'other'
  if (t === 'checkbox' || t === 'radio') return 'box'
  if (t === 'file') return 'file'
  return TEXT_TYPES.has(t) ? 'field' : 'other'
}

/** The page's outline, headed by its title and address. */
export const outlinePage = async (state: PageState, maxChars: number): Promise<string> => {
  const body = (await evaluate<string>(state, outlineCall('outline', maxChars))) ?? ''
  const title = (await evaluate<string>(state, 'document.title')) ?? ''
  const href = (await evaluate<string>(state, 'location.href')) ?? state.view.url
  return `Page title: ${title}\nAddress: ${href}\n${body === '' ? '(the page shows nothing yet)' : body}`
}

/** The kind of the one element `target` names (fails as a click would when there is not one). */
export const probeElement = async (
  state: PageState,
  target: BrowserLocator,
  timeoutMs: number
): Promise<BrowserElementKind> => {
  const match = await findOne(state, target, { timeoutMs })
  return kindOfElement(match.tag, match.type)
}
