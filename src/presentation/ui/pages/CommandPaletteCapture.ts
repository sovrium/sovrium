/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The synchronous inline ⌘K command-palette open-capture for the admin dashboard
 *. Extracted from {@link./DynamicPage} to keep that
 * file under its `max-lines` cap.
 *
 * The dashboard's `admin-search-palette` island (hosted by the config-native
 * `command-palette` component, admin mode) is a React island, so its `⌘K` open
 * listener only attaches once the island has mounted — a race after an in-app
 * navigation, where a `⌘K` press can land before hydration and be lost. The
 * capture script below is emitted FIRST in the page `<head>` so it runs during
 * HTML parse (before `islands.js` downloads) and records the open intent; the
 * island replays it on mount.
 */

import type { Component } from '@/domain/models/app/pages/components'

/**
 * True when the page carries the admin dashboard's ⌘K palette
 * (the config-native `command-palette` component, admin mode, that `wrapInShell`
 * injects — Consoles-as-Config C3). Used to decide whether to emit the
 * synchronous inline open-capture script.
 */
export function hasCommandPaletteHost(
  components: ReadonlyArray<Component | string> | undefined
): boolean {
  if (!components) return false
  return components.some((item) => {
    if (typeof item === 'string') return false
    if ('component' in item || '$ref' in item) return false
    const component = item as Component
    const props = (component as Record<string, unknown>).props as
      Record<string, unknown> | undefined
    // The admin shell expresses its ⌘K palette as a config `command-palette`
    // component flagged `adminSearch` (it hosts the `admin-search-palette` island).
    if (
      (component as { readonly type?: string }).type === 'command-palette' &&
      props?.['adminSearch'] === true
    ) {
      return true
    }
    const { children } = component as { readonly children?: ReadonlyArray<Component | string> }
    return hasCommandPaletteHost(children)
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
/**
 * Mobile sidebar drawer toggle. Folded into the
 * same inline script so it runs during HTML parse — before `islands.js` — and is
 * live the instant the burger renders. On a mobile viewport the sidebar `aside`
 * (`[data-dashboard-aside]`) is `hidden`; clicking the burger
 * (`[data-dashboard-burger]`) reveals it as a fixed drawer with a dismiss
 * backdrop. A second burger click, a backdrop click, or Escape closes it. Pure
 * classList manipulation (no island dependency) so the drawer works regardless of
 * sidebar hydration timing.
 */
const SIDEBAR_DRAWER_TOGGLE_SNIPPET = `var __svDrawerClasses=["fixed","inset-y-0","left-0","z-40","flex","shadow-xl"];
function __svBackdrop(){var b=document.getElementById("sv-sidebar-backdrop");if(b)return b;b=document.createElement("div");b.id="sv-sidebar-backdrop";b.className="fixed inset-0 z-30 bg-scrim/50 md:hidden";b.addEventListener("click",__svCloseDrawer);document.body.appendChild(b);return b}
function __svOpenDrawer(a){a.classList.remove("hidden");__svDrawerClasses.forEach(function(c){a.classList.add(c)});a.setAttribute("data-mobile-open","true");__svBackdrop()}
function __svCloseDrawer(){var a=document.querySelector('[data-dashboard-aside]');if(a){__svDrawerClasses.forEach(function(c){a.classList.remove(c)});a.classList.add("hidden");a.removeAttribute("data-mobile-open")}var b=document.getElementById("sv-sidebar-backdrop");if(b)b.remove()}
document.addEventListener("click",function(e){var t=e.target;if(!t||!t.closest)return;if(t.closest('[data-dashboard-burger]')){e.preventDefault();var a=document.querySelector('[data-dashboard-aside]');if(!a)return;if(a.getAttribute("data-mobile-open")==="true"){__svCloseDrawer()}else{__svOpenDrawer(a)}}},true);
document.addEventListener("keydown",function(e){if(e.key==="Escape"){__svCloseDrawer()}},true);`

export const COMMAND_PALETTE_CAPTURE_SCRIPT = `(function(){
"use strict";
function open(){window.__sovriumOpenCommandPalette=true;document.dispatchEvent(new CustomEvent("sovrium:open-command-palette"))}
document.addEventListener("keydown",function(e){if((e.metaKey||e.ctrlKey)&&e.key&&e.key.toLowerCase()==="k"){e.preventDefault();open()}},true);
document.addEventListener("click",function(e){var t=e.target;if(t&&t.closest&&t.closest('[data-command-palette-trigger]')){e.preventDefault();open()}},true);
${SIDEBAR_DRAWER_TOGGLE_SNIPPET}
})();`
