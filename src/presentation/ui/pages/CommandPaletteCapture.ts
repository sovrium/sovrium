/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { Component } from '@/domain/models/app/pages/components'

export function hasCommandPaletteHost(
  components: ReadonlyArray<Component | string> | undefined
): boolean {
  if (!components) return false
  return components.some((item) => {
    if (typeof item === 'string') return false
    if ('component' in item || '$ref' in item) return false
    const component = item as Component
    const props = (component as Record<string, unknown>).props as
      | Record<string, unknown>
      | undefined
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
document.addEventListener("click",function(e){var t=e.target;if(t&&t.closest&&t.closest('[aria-label="Rechercher"]')){e.preventDefault();open()}},true);
${SIDEBAR_DRAWER_TOGGLE_SNIPPET}
})();`
