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
 * They are not ONE script behind ONE gate: if the mobile sidebar drawer toggle
 * travelled inside the command palette's open-capture, a page with a sidebar
 * and no palette would have no burger at all — on a viewport where the sidebar
 * is hidden, that is a page with no navigation. They are unrelated behaviours
 * with unrelated triggers, so they are two scripts on two gates.
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
 * True when the page carries a ⌘K palette, in either mode.
 *
 * Both modes are islands now, and both need the capture: the search mode's
 * listener attaches only once it has mounted, so a keypress landing before
 * hydration — the ordinary case right after an in-app navigation — would be
 * lost; and the built-in mode does not mount at all until the capture asks for
 * it on the first open.
 */
export function hasCommandPaletteHost(
  components: ReadonlyArray<Component | string> | undefined
): boolean {
  return someComponent(components, (component) => component.type === 'command')
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
 * Synchronous inline open-capture for the ⌘K command palette.
 *
 * Emitted in `<head>` so it runs during HTML parse, before the island runtime
 * downloads, and captures a `⌘K` / `Ctrl+K` press (or a
 * `[data-command-palette-trigger]` click). It records the intent in
 * `window.__sovriumOpenCommandPalette` and dispatches
 * `sovrium:open-command-palette`, which the island replays on mount and
 * subscribes to thereafter, so no early open intent is lost.
 *
 * It is also what brings the BUILT-IN palette to life. That palette's host is
 * rendered as `data-island-deferred="command"` so no page pays for it before a
 * reader asks for it: on the first open the capture turns the marker into a
 * `data-island`, then either loads the island runtime (a page with no other
 * island names its entry in an inert `<template data-island-entry>`) or asks
 * the already-running one to mount it (`sovrium:mount-islands`).
 */
export const COMMAND_PALETTE_CAPTURE_SCRIPT = `(function(){
"use strict";
function wake(){var h=document.querySelector("[data-island-deferred]");if(!h)return;h.setAttribute("data-island",h.getAttribute("data-island-deferred"));h.removeAttribute("data-island-deferred");var t=document.querySelector("template[data-island-entry]");if(t){var s=document.createElement("script");s.type="module";s.src=t.getAttribute("data-island-entry");t.remove();document.head.appendChild(s)}else{document.dispatchEvent(new CustomEvent("sovrium:mount-islands"))}}
function open(){window.__sovriumOpenCommandPalette=true;wake();document.dispatchEvent(new CustomEvent("sovrium:open-command-palette"))}
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
function __svBackdrop(){var b=document.getElementById("sv-sidebar-backdrop");if(b)return b;b=document.createElement("div");b.id="sv-sidebar-backdrop";b.className="fixed inset-0 z-30 bg-black/10 supports-backdrop-filter:backdrop-blur-xs md:hidden";b.addEventListener("click",__svCloseDrawer);document.body.appendChild(b);return b}
function __svOpenDrawer(a){a.classList.remove("hidden");__svDrawerClasses.forEach(function(c){a.classList.add(c)});a.setAttribute("data-mobile-open","true");__svBackdrop()}
function __svCloseDrawer(){var a=document.querySelector('[data-dashboard-aside]');if(a){__svDrawerClasses.forEach(function(c){a.classList.remove(c)});a.classList.add("hidden");a.removeAttribute("data-mobile-open")}var b=document.getElementById("sv-sidebar-backdrop");if(b)b.remove()}
document.addEventListener("click",function(e){var t=e.target;if(!t||!t.closest)return;if(t.closest('[data-dashboard-burger]')){e.preventDefault();var a=document.querySelector('[data-dashboard-aside]');if(!a)return;if(a.getAttribute("data-mobile-open")==="true"){__svCloseDrawer()}else{__svOpenDrawer(a)}}},true);
document.addEventListener("keydown",function(e){if(e.key==="Escape"){__svCloseDrawer()}},true);
})();`
