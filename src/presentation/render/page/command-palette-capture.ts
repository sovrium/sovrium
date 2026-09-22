/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Two synchronous inline `<head>` scripts, and the predicates that decide which
 * of them a page needs.
 *
 * They used to be ONE script behind ONE gate, and that was the defect: the
 * mobile sidebar drawer toggle travelled inside the command palette's
 * open-capture, so a page with a sidebar and no palette had no burger at all —
 * on a viewport where the sidebar is hidden, that is a page with no navigation.
 * They are unrelated behaviours with unrelated triggers, so they are now two
 * scripts on two gates.
 */

import { isNavigationSidebar } from '@/presentation/render/registry/search-palette-mode'
import type { Component } from '@/domain/models/app/pages/components'

/** Walk a component tree (including `children`) testing each real component. */
function someComponent(
  items: ReadonlyArray<Component | string> | undefined,
  predicate: (component: Component) => boolean
): boolean {
  if (!items) return false
  return items.some((item) => {
    if (typeof item === 'string') return false
    if ('component' in item || '$ref' in item) return false
    const component = item as Component
    if (predicate(component)) return true
    const { children } = component as { readonly children?: ReadonlyArray<Component | string> }
    return someComponent(children, predicate)
  })
}

/**
 * True when the page's ⌘K palette is hosted by an ISLAND — the search mode,
 * reached either by an authored `search` block or by the console's builder-set
 * `props.adminSearch` flag.
 *
 * The gate is island-hosting and not "has a palette". A React island's ⌘K
 * listener attaches only once it has mounted, so a keypress landing before
 * hydration — the ordinary case right after an in-app navigation — is lost
 * without the capture. The BUILT-IN mode needs no capture at all: its listener
 * is attached by a synchronous inline script that is already live at parse
 * time, so emitting one would duplicate a live listener.
 */
export function hasCommandPaletteHost(
  components: ReadonlyArray<Component | string> | undefined
): boolean {
  return someComponent(components, (component) => {
    if (component.type !== 'command-palette') return false
    const { search, props } = component as {
      readonly search?: unknown
      readonly props?: Record<string, unknown>
    }
    if (search !== undefined) return true
    return props?.['adminSearch'] === true
  })
}

/**
 * True when the page carries a sidebar the mobile drawer can open.
 *
 * Either a `sidebar` component with navigation groups, or any component
 * carrying the `data-dashboard-aside` marker the toggle keys on — the console's
 * shell expresses its aside as a marked `container` rather than as a `sidebar`,
 * and both must get a working burger.
 */
export function hasDrawerSidebar(
  components: ReadonlyArray<Component | string> | undefined
): boolean {
  return someComponent(components, (component) => {
    if (isNavigationSidebar(component)) return true
    const { props } = component as { readonly props?: Record<string, unknown> }
    return props?.['data-dashboard-aside'] !== undefined
  })
}

/**
 * Synchronous inline open-capture for the ⌘K command palette
 *. Emitted in `<head>` so it runs during HTML parse —
 * BEFORE `islands.js` downloads — and captures a `⌘K` / `Ctrl+K` press (or a
 * search-affordance click) that lands before the palette island hydrates
 * (e.g. right after an in-app navigation). It records the intent in
 * `window.__sovriumOpenCommandPalette` and dispatches `sovrium:open-command-palette`,
 * which the island replays on mount and subscribes to thereafter — so no early
 * open intent is lost.
 */
export const COMMAND_PALETTE_CAPTURE_SCRIPT = `(function(){
"use strict";
function open(){window.__sovriumOpenCommandPalette=true;document.dispatchEvent(new CustomEvent("sovrium:open-command-palette"))}
document.addEventListener("keydown",function(e){if((e.metaKey||e.ctrlKey)&&e.key&&e.key.toLowerCase()==="k"){e.preventDefault();open()}},true);
document.addEventListener("click",function(e){var t=e.target;if(t&&t.closest&&t.closest('[data-command-palette-trigger]')){e.preventDefault();open()}},true);
})();`

/**
 * Mobile sidebar drawer toggle. A script of its
 * OWN, on its OWN gate: it is the sidebar's behaviour, and a page carrying a
 * sidebar and no palette must still have a burger that works.
 *
 * Emitted in `<head>` so it runs during HTML parse — before `islands.js` — and
 * is live the instant the burger renders. On a mobile viewport the sidebar
 * (`[data-dashboard-aside]`) is `hidden`; clicking the burger
 * (`[data-dashboard-burger]`) reveals it as a fixed drawer with a dismiss
 * backdrop. A second burger click, a backdrop click, or Escape closes it. Pure
 * classList manipulation (no island dependency) so the drawer works regardless
 * of sidebar hydration timing.
 */
export const SIDEBAR_DRAWER_TOGGLE_SCRIPT = `(function(){
"use strict";
var __svDrawerClasses=["fixed","inset-y-0","left-0","z-40","flex","shadow-lg"];
function __svBackdrop(){var b=document.getElementById("sv-sidebar-backdrop");if(b)return b;b=document.createElement("div");b.id="sv-sidebar-backdrop";b.className="fixed inset-0 z-30 bg-scrim/50 md:hidden";b.addEventListener("click",__svCloseDrawer);document.body.appendChild(b);return b}
function __svOpenDrawer(a){a.classList.remove("hidden");__svDrawerClasses.forEach(function(c){a.classList.add(c)});a.setAttribute("data-mobile-open","true");__svBackdrop()}
function __svCloseDrawer(){var a=document.querySelector('[data-dashboard-aside]');if(a){__svDrawerClasses.forEach(function(c){a.classList.remove(c)});a.classList.add("hidden");a.removeAttribute("data-mobile-open")}var b=document.getElementById("sv-sidebar-backdrop");if(b)b.remove()}
document.addEventListener("click",function(e){var t=e.target;if(!t||!t.closest)return;if(t.closest('[data-dashboard-burger]')){e.preventDefault();var a=document.querySelector('[data-dashboard-aside]');if(!a)return;if(a.getAttribute("data-mobile-open")==="true"){__svCloseDrawer()}else{__svOpenDrawer(a)}}},true);
document.addEventListener("keydown",function(e){if(e.key==="Escape"){__svCloseDrawer()}},true);
})();`
