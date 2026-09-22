/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { extractComponentMetaFromSections } from '@/presentation/render/page/extract-component-meta'
// Island-runtime detection lives in page-island-detection.ts (extracted on main);
// this file keeps only interactive-runtime detection, which shares the same
// reference-aware walker so a template-hosted action button also ships client.js.
import { someComponentInTree } from '@/presentation/render/resolve/component-template-walker'
import type { Components } from '@/domain/models/app/components'
import type { Page } from '@/domain/models/app/pages'

/**
 * Component types whose mere presence makes a page need `/assets/client.js`.
 *
 * Two entries were removed here and neither is a rename waiting to happen.
 *
 * `modal` was dead twice over. The type is retired (`retired-types.ts`), so a
 * config naming it is refused at decode; and its runtime half was dead too —
 * nothing emits `data-modal-trigger`, and the zero-JS dialog runs off the
 * inline `clickScript` in `page-body-scripts.tsx` keyed on `[data-click-modal]`.
 *
 * `dropdown` named no component type at all. The real type is `dropdown-menu`,
 * and writing THAT here would be a regression rather than a repair:
 * `dropdown-menu` is already in `ISLAND_COMPONENT_TYPES`, so it gets the
 * runtime it needs from the island gate. The two gates emit DIFFERENT scripts,
 * and this bundle carries modal lifecycle, toasts, filter/sort submission,
 * fetch-button dispatch, native-select publishers and session text — nothing a
 * menu uses. Adding it would ship a second bundle to every page holding a
 * dropdown for zero behaviour, against the ecoconception default.
 * `[internal ref]` fails the moment it is written back in.
 */
const INTERACTIVE_COMPONENT_TYPES = new Set(['form', 'table'])

/**
 * True for a component that binds to the caller's session: a `session` field, or a `$session.<field>` token in `content`.
 * Such a `text` carries no `action`, so without this it would never emit
 * `/assets/client.js` and the global session-text enhancer (which fills it from
 * `GET /api/auth/get-session`) would never run.
 */
function componentIsSessionBound(record: Record<string, unknown>): boolean {
  if (typeof record['session'] === 'string') return true
  const { content } = record
  return typeof content === 'string' && content.includes('$session.')
}

/**
 * True for a `select.native` that also PUBLISHES on a shared-filter channel
 *. The platform control mounts no island, so its `change` → dispatch
 * is bound by the global vanilla runtime — and without this the declaration
 * would be inert on any page whose only other components are static, which is
 * precisely a filter bar over a read endpoint.
 */
function componentIsNativeSelectPublisher(record: Record<string, unknown>): boolean {
  return record['type'] === 'select' && record['native'] === true && Boolean(record['publishes'])
}

/** True if THIS component (ignoring children) is interactive. */
function componentSelfIsInteractive(record: Record<string, unknown>): boolean {
  const { type } = record
  if (typeof type === 'string' && INTERACTIVE_COMPONENT_TYPES.has(type)) return true
  if (record['action']) return true
  if (componentIsSessionBound(record)) return true
  if (componentIsNativeSelectPublisher(record)) return true
  const props = record['props'] as Record<string, unknown> | undefined
  return Boolean(props?.['action'] || props?.['interactions'])
}

/**
 * Checks if a page has interactive features that require the client runtime
 *
 * Returns true if the page has components with action types (auth, crud, filter),
 * a `form` or a `table`, a session-bound component, or a publishing native
 * `select` — at any nesting depth. It said "modal components ... and dropdowns"
 * for as long as {@link INTERACTIVE_COMPONENT_TYPES} carried those two dead
 * entries; see the note there for why neither came back.
 *
 * Action buttons are frequently nested inside layout containers
 * (header → section → card → button) OR hosted inside a referenced
 * `app.components` template, so detection walks children AND resolves
 * references (via `someComponentInTree`) — otherwise a deeply-nested or
 * template-hosted logout/automation button would never emit
 * `/assets/client.js` and the button would be inert.
 */
export function hasInteractiveFeatures(page: Page, components?: Components): boolean {
  return someComponentInTree(page.components, components, componentSelfIsInteractive)
}

/**
 * Merges component metadata with page metadata
 *
 * @param page - Page configuration
 * @param components - Available component templates
 * @returns Page with merged metadata
 */
export function mergeComponentMetaIntoPage(page: Page, components?: Components): Page {
  const componentOpenGraph = extractComponentMetaFromSections(page.components, components)

  if (!componentOpenGraph || !page.meta) return page

  return {
    ...page,
    meta: {
      ...page.meta,
      openGraph: {
        ...page.meta.openGraph,
        ...componentOpenGraph,
      },
    },
  }
}
