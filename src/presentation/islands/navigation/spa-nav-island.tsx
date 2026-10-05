/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `spa-nav` island — content-only (SPA) navigation over ONE region of a page.
 * Registered twice: as `admin-spa-nav`, the operator console's shell marker
 *, and as `spa-nav`, the hidden host an app page
 * renders beside its main region when its sidebar sets `clientSideNavigation`
 * (`render/page/page-spa-nav-mount.tsx`, props `{ regionId: 'main-content',
 * scope: 'app' }`).
 *
 * Progressive enhancement: links stay real `<a href>` (the page works without
 * JS — a full reload). When mounted, this island intercepts plain left-clicks
 * on same-origin links its scope serves and swaps ONLY the region named by
 * `regionId` via a content-only partial fetch, keeping everything outside it
 * mounted (the console's persistent sidebar + ⌘K palette).
 *
 * It also (a) routes navigation requests from other islands (the ⌘K palette)
 * through the same swap path (`spa-nav-request.ts`), (b) handles browser
 * back/forward by re-fetching + swapping on `popstate` (no pushState), and
 * (c) falls back to a full navigation on any answer that is not a partial or
 * on a fetch error (SPA-007).
 *
 * Props, both optional so the console's shell marker needs none:
 *   - `regionId` — the id of the swapped region (default `admin-surface-content`);
 *   - `scope` — `mount` (default) serves the console's own mount and keeps the
 *     region node; `app` serves an app's own pages and replaces the node.
 *
 * Renders nothing — it only wires document/window-level listeners. A PRIORITY
 * island so the click interceptor is live before the first nav click.
 */

import { type ReactElement } from 'react'
import { useSpaNavigation } from './spa-nav-controller'
import type { SpaNavScope } from './spa-nav-partial'
import type { SpaRegion } from './spa-nav-swap'

/** The console's swap region — the default, so its shell marker needs no props. */
const DEFAULT_REGION_ID = 'admin-surface-content'

/** The island's props, as parsed from `data-island-props`. */
export interface SpaNavIslandProps {
  readonly regionId?: unknown
  readonly scope?: unknown
}

/** Read the region and scope off the props, defaulting each to the console's. */
function resolveRegion(props: SpaNavIslandProps): SpaRegion {
  const regionId =
    typeof props.regionId === 'string' && props.regionId !== '' ? props.regionId : DEFAULT_REGION_ID
  const scope: SpaNavScope = props.scope === 'app' ? 'app' : 'mount'
  return { regionId, scope }
}

/** SPA-nav island — renders nothing; wires content-only navigation. */
export default function SpaNavIsland(props: SpaNavIslandProps): ReactElement | null {
  useSpaNavigation(resolveRegion(props))
  // eslint-disable-next-line unicorn/no-null -- React components must return null to render nothing
  return null
}
