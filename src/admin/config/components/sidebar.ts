/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The console's persistent sidebar, as config.
//
// ─── WHAT THIS REPLACES ────────────────────────────────────────────────────
//
// A 1,492-line island family under `src/presentation/islands/admin/sidebar/`,
// mounted through a `data-island: 'admin-sidebar'` marker on the shell's aside.
// Everything it did that a reader can observe is expressed by the generic
// `sidebar` component, in this file and its `sidebar-*.ts` siblings: named
// landmarks, headed sections, per-row testids, lazily-fetched disclosures, and
// a client-re-derived current-row mark.
//
// This is the point of the exercise, not a side effect of it. The console is
// Sovrium's own app; a chrome it can only build in TypeScript is a chrome no
// operator's app can build at all. Every gap that forced the island to exist was
// closed as a GENERIC primitive first (`groups[].landmark`, `headingLevel`,
// `items[].props` / `childrenProps` / `source.itemProps`, disclosure over
// `children` XOR `source`, `trackNavigation`), so what is left here is authoring.
//
// ─── HREFS ARE MOUNT-RELATIVE, AND THAT IS LOAD-BEARING ────────────────────
//
// Every `href` and `hrefTemplate` in these files is written WITHOUT the `/_admin` prefix.
// `prefixMountHrefs` (`src/domain/models/app/admin/mount-hrefs.ts`) walks the decoded config
// and moves each onto the console's base at boot, so `/tables` authored here is
// `/_admin/tables` as served. Writing `/_admin/tables` here would double the
// prefix.
//
// `endpoint` is deliberately NOT in that walk: `/api/admin/*` is mounted once for
// the whole server and is not part of the console's base. So endpoints stay
// absolute and hrefs stay relative — the two spellings are not interchangeable.
//
// ─── THE ORDER OF THE PIECES IS FORCED BY THE RENDERER ─────────────────────
//
// `structural-components.tsx` renders a `sidebar`'s `groups` BEFORE its authored
// `children`, and a `sidebar` is always a `div` (it takes no `element`). So the
// brand header and the search trigger cannot be children of the sidebar node —
// they would land under the nav. They are siblings of it inside the `aside`,
// which is the frame that also carries the drawer markers.
//
// ─── THE PIECES LIVE IN SIBLINGS ───────────────────────────────────────────
//
// `sidebar-head.ts` (brand row, search trigger), `sidebar-nav.ts` (the
// navigation and its row helpers) and `sidebar-operator-menu.ts` (the foot).
// This file is the frame that assembles them in the order the renderer forces.

import { brandHeader, searchTrigger } from './sidebar-head'
import { consoleNav } from './sidebar-nav'
import { operatorMenu } from './sidebar-operator-menu'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * The console's persistent sidebar: the `aside` frame and everything in it.
 *
 * Both drawer markers ride on this one element. `data-dashboard-aside` is what
 * the renderer's inline burger script toggles; `data-dashboard-sidebar` is the
 * ancestor `[internal ref]` walks up from the focused element
 * to prove Tab reached the navigation. They sat on two nested nodes while the
 * island rendered the inner one, and collapse onto one now that nothing renders
 * between the frame and the nav.
 *
 * `overflow-hidden` on the frame, with the scroll on `consoleNav`: the aside is
 * a fixed-height column whose FOOT (the operator menu) must stay pinned while
 * the nav scrolls. Two nested scroll containers made the foot ride the outer
 * scroll instead.
 */
export const consoleSidebar: PageComponent = {
  type: 'container',
  element: 'aside',
  props: {
    className:
      'hidden md:flex w-64 md:max-xl:w-14 shrink-0 border-r border-border bg-background-raised p-4 md:max-xl:px-2.5 flex-col gap-4 overflow-hidden',
    'data-dashboard-aside': 'true',
    'data-dashboard-sidebar': 'true',
  },
  // No language control here. The setting lives on `/profile`, where it is a
  // per-ACCOUNT choice the server keeps (`POST /api/auth/update-user`) rather
  // than a per-BROWSER one, and where a label can say so. Founder decision of
  // 2026-09-19: no language button at the bottom of the sidebar. It also ends
  // the reachability defect the wrapper here papered over — the switcher was
  // `md:max-xl:hidden`, so between 768 and 1279 the setting existed nowhere.
  children: [brandHeader, searchTrigger, consoleNav, operatorMenu],
} as PageComponent
