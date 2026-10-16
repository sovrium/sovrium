/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Design } from '@/domain/models/app/design'

/**
 * Build the no-FOUC color-scheme bootstrap script body.
 *
 * Runs synchronously in `<head>` ahead of the stylesheet so the `dark` class
 * is on `<html>` before first paint (no flash of the wrong scheme). Resolution
 * order: stored `localStorage.theme` override → configured `colorScheme`
 * ('dark'/'light') → system `prefers-color-scheme` ('system' or unset).
 *
 * Under `system` with no stored override it also FOLLOWS the system: a change
 * of `prefers-color-scheme` while the page is open re-applies the class, so a
 * page does not stay in the scheme it loaded in until the next navigation. A
 * stored choice made since (the toggle) stops the follow.
 *
 * The body deliberately contains no `<` characters before `classList` so the
 * no-FOUC spec regex (`localStorage … classList`) matches.
 */
/**
 * The localStorage key the toggle writes and this script reads.
 *
 * Spelled `theme` and NOT renamed with the config key. It is a value stored in
 * a visitor's browser, so renaming it does not migrate anything — it abandons
 * every preference already stored under the old name and silently resets each
 * returning visitor to the system default. A config key is ours to rename; a
 * key in someone else's browser is not.
 */
const COLOR_SCHEME_STORAGE_KEY = 'theme'

export function buildColorSchemeScript(colorScheme: Design['colorScheme']): string {
  // Configured default when there is no stored override: 'dark' | 'light' |
  // 'system'. Anything else (undefined) falls back to system preference.
  const configured = colorScheme === 'dark' || colorScheme === 'light' ? colorScheme : 'system'
  return `(function(){try{var stored=window.localStorage.getItem('${COLOR_SCHEME_STORAGE_KEY}');var dark;if(stored==='dark'){dark=true}else if(stored==='light'){dark=false}else{var configured='${configured}';if(configured==='dark'){dark=true}else if(configured==='light'){dark=false}else{dark=window.matchMedia('(prefers-color-scheme: dark)').matches}}var root=document.documentElement;if(dark){root.classList.add('dark')}else{root.classList.remove('dark')}if(stored!=='dark'&&stored!=='light'&&configured==='system'){window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(event){var now=window.localStorage.getItem('${COLOR_SCHEME_STORAGE_KEY}');if(now!=='dark'&&now!=='light'){root.classList.toggle('dark',event.matches)}})}}catch(e){}})();`
}
